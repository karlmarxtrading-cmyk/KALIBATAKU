// Native arithmetic typesetter. Lays out the validated presentation tokens from
// model.mjs (numbers, stacked fractions, + − × ÷ and parentheses) as SVG using the
// local Noto Sans outlines. No network, no fonts, no MathML engine are required.
import G from './glyphs.mjs';

const EM=G.units_per_em, AXIS=G.axis, RULE=Math.round(G.rule*.86), DIGIT=G.digit_height;
const FRACTION_SCALE=.9, GAP=100, BAR_PAD=70, OP_SPACE=230, MIN_HEIGHT=780, MIN_DEPTH=190;
const PAREN_TOP=714, PAREN_BOTTOM=-158;

function textBox(text,scale=1){
  const parts=[];let x=0;
  for(const ch of text){const g=G.glyphs[ch];if(!g)throw Error('GLYPH_MISSING');parts.push({d:g.d,x,scale});x+=g.w*scale;}
  return {width:x,parts};
}
// Pair parentheses across the whole token list so that a pair split over two line
// groups still stretches to the same size.
function parenSizes(tokens){
  const sizes=new Map(),stack=[];
  const extent=t=>t.type==='fraction'?fractionMetrics(t):{height:PAREN_TOP,depth:-PAREN_BOTTOM};
  for(let i=0;i<tokens.length;i++){
    const t=tokens[i];
    if(t.type==='sign'&&t.text==='(')stack.push({i,height:PAREN_TOP,depth:-PAREN_BOTTOM});
    else if(t.type==='sign'&&t.text===')'){
      const open=stack.pop();if(!open)continue;
      const size={height:open.height,depth:open.depth};sizes.set(open.i,size);sizes.set(i,size);
      if(stack.length){const up=stack.at(-1);up.height=Math.max(up.height,size.height+60);up.depth=Math.max(up.depth,size.depth+60);}
    }else if(stack.length){const e=extent(t),top=stack.at(-1);top.height=Math.max(top.height,e.height+40);top.depth=Math.max(top.depth,e.depth+40);}
  }
  return sizes;
}
function fractionMetrics(t){
  const s=FRACTION_SCALE,num=textBox(t.n,s),den=textBox(t.d,s);
  const width=Math.max(num.width,den.width)+2*BAR_PAD;
  const numBase=AXIS+RULE/2+GAP+10*s, denBase=AXIS-RULE/2-GAP-DIGIT*s;
  return {num,den,width,numBase,denBase,height:numBase+DIGIT*s,depth:-denBase+10*s};
}
// Lay out one group of tokens. Returns sizes in font units and drawable primitives.
export function layoutGroup(group,sizes=new Map(),offset=0){
  const paths=[],rects=[];let x=0,height=MIN_HEIGHT,depth=MIN_DEPTH,fractions=0;
  group.forEach((t,k)=>{
    if(t.type==='op'){x+=OP_SPACE;const b=textBox(t.text);for(const p of b.parts)paths.push({...p,x:x+p.x,y:0});x+=b.width+OP_SPACE;return;}
    if(t.type==='number'){const b=textBox(t.text);for(const p of b.parts)paths.push({...p,x:x+p.x,y:0});x+=b.width;return;}
    if(t.type==='fraction'){
      const f=fractionMetrics(t);fractions++;
      const nx=x+(f.width-f.num.width)/2,dx=x+(f.width-f.den.width)/2;
      for(const p of f.num.parts)paths.push({...p,x:nx+p.x,y:f.numBase});
      for(const p of f.den.parts)paths.push({...p,x:dx+p.x,y:f.denBase});
      rects.push({x:x+BAR_PAD/3,y:AXIS+RULE/2,width:f.width-2*BAR_PAD/3,height:RULE,fraction:true});
      x+=f.width;height=Math.max(height,f.height+60);depth=Math.max(depth,f.depth+60);return;
    }
    if(t.type==='sign'){
      const g=G.glyphs[t.text];if(!g)throw Error('GLYPH_MISSING');
      const size=sizes.get(offset+k);
      let sy=1,ty=0;
      if(size&&(size.height>PAREN_TOP+1||size.depth>-PAREN_BOTTOM+1)){
        sy=(size.height+size.depth)/(PAREN_TOP-PAREN_BOTTOM);ty=size.height-PAREN_TOP*sy;
        height=Math.max(height,size.height+30);depth=Math.max(depth,size.depth+30);
      }
      paths.push({d:g.d,x,y:ty,scale:1,sy});x+=g.w;return;
    }
    throw Error('INVALID_TOKEN');
  });
  return {width:x,height,depth,paths,rects,fractions};
}
// Operators start a new group so that long expressions wrap between whole units.
export function groupsOf(tokens){
  const groups=[];let current=[],start=0,i=0;
  for(const t of tokens){if(t.type==='op'&&current.length){groups.push({tokens:current,start});current=[];start=i;}current.push(t);i++;}
  if(current.length)groups.push({tokens:current,start});
  return groups;
}
export function layout(tokens){
  const sizes=parenSizes(tokens);
  return groupsOf(tokens).map(g=>layoutGroup(g.tokens,sizes,g.start));
}
const NS='http://www.w3.org/2000/svg';
const n=v=>Math.round(v*10)/10, em=v=>Math.round(v*1000)/1000+'em';
export function svgElement(box,doc=document){
  const svg=doc.createElementNS(NS,'svg');
  const pad=20,w=box.width+2*pad,h=box.height+box.depth;
  svg.setAttribute('viewBox',`${n(-pad)} ${n(-box.height)} ${n(w)} ${n(h)}`);
  svg.setAttribute('width',em(w/EM));svg.setAttribute('height',em(h/EM));
  svg.style.verticalAlign=em(-box.depth/EM);
  svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.setAttribute('class','math-svg');
  svg.setAttribute('fill','currentColor');
  for(const p of box.paths){
    const path=doc.createElementNS(NS,'path');path.setAttribute('d',p.d);
    const sy=(p.sy||1)*p.scale;
    path.setAttribute('transform',`translate(${n(p.x)} ${n(-p.y)})`+(p.scale!==1||sy!==1?` scale(${n(p.scale*1000)/1000} ${Math.round(sy*1000)/1000})`:''));
    svg.append(path);
  }
  for(const r of box.rects){
    const rect=doc.createElementNS(NS,'rect');
    rect.setAttribute('x',n(r.x));rect.setAttribute('y',n(-r.y));rect.setAttribute('width',n(r.width));rect.setAttribute('height',n(r.height));
    if(r.fraction)rect.dataset.fractionBar='';
    svg.append(rect);
  }
  if(box.fractions)svg.dataset.fractions=String(box.fractions);
  return svg;
}
export function render(tokens,doc=document){return layout(tokens).map(b=>svgElement(b,doc));}
export const version='kalibataku-typeset-1';
