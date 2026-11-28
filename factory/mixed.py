"""Whitelisted finite MIX expression families. Unification checks every leaf and operator.
Extra values derived from slot bindings are independently reconstructed by the predicate.
"""
from domains import *
from functools import lru_cache

def A(a,b):return ('ADD',a,b)
def S(a,b):return ('SUB',a,b)
def M(a,b):return ('MUL',a,b)
def Q(a,b):return ('DIV',a,b)

def opval(op,x,y):
    if op=='ADD':return x+y
    if op=='SUB':return x-y
    if op=='MUL':return x*y
    return x/y

def trace(t):
    if isinstance(t,str):return [val(t)]
    l,r=trace(t[1]),trace(t[2])
    return l+r+[opval(t[0],l[-1],r[-1])]

def fill(shape,variables):
    if isinstance(shape,str):return variables.get(shape,shape)
    return (shape[0],fill(shape[1],variables),fill(shape[2],variables))

def bind(shape,t,slots,seen):
    if isinstance(shape,str):
        if not isinstance(t,str):return False
        if shape not in slots:return t==shape
        if shape in seen:return seen[shape]==t
        seen[shape]=t
        return True
    return isinstance(t,tuple) and shape[0]==t[0] and bind(shape[1],t[1],slots,seen) and bind(shape[2],t[2],slots,seen)

class Shape:
    def __init__(self,shape,grids,predicate=None):
        self.shape=shape;self.grids={k:unique(v) for k,v in grids.items()}
        self.allow={k:frozenset(v) for k,v in self.grids.items()}
        self.predicate=predicate
    def candidates(self,key):
        pools=list(self.grids.values());length=1
        for p in pools:length*=len(p)
        rng=seeded(key)
        offset=rng.randrange(length);step=rng.randrange(1,max(2,length))
        while gcd(step,length)!=1:step+=1
        for k in range(length):
            n=(offset+k*step)%length
            vals={}
            for key,pool in self.grids.items():
                n,idx=divmod(n,len(pool));vals[key]=pool[idx]
            if self.predicate and not self.predicate(**{s:val(v) for s,v in vals.items()}):continue
            yield fill(self.shape,vals)
    def accepts(self,t):
        seen={}
        return bind(self.shape,t,self.grids,seen) and set(seen)==set(self.grids) and all(v in self.allow[k] for k,v in seen.items()) and (not self.predicate or self.predicate(**{k:val(v) for k,v in seen.items()}))

class Mix:
    def __init__(self,g,l,limit,den=1,dp=None):
        self.g,self.l,self.limit,self.den,self.dp=g,l,limit,den,dp; self.shapes=[];self.exhaustive=False
    def add(self,name,shape,grids,p=None):self.shapes.append((name,Shape(shape,grids,p)))
    def bounds(self,t):
        try:values=trace(t)
        except ZeroDivisionError:return False
        if self.g<=6 and min(values)<0:return False
        return all((self.limit is None or abs(x)<=self.limit) and x.denominator<=self.den and (self.dp is None or (10**self.dp)%x.denominator==0) for x in values)
    def candidates(self):
        for i,(name,shape) in enumerate(self.shapes):
            def stream(name=name,i=i,shape=shape):
                for t in shape.candidates((self.g,self.l,i)):
                    if self.bounds(t):yield t,name
            yield stream()
    def accept(self,t):
        return any(shape.accepts(t) for _,shape in self.shapes) and self.bounds(t)
def extend(shape,kind,key):
    return {'ADD':A,'SUB':S,'MUL':M,'DIV':Q}[kind](shape,key)

def mix(g,l):
    lims={1:[0,0,0,0,100],2:[99,100,120,500,500],3:[120,500,2000,1800,3000],4:[100000,15000,20000,20000,30000],5:[20000,20000,120,120,10000],6:[None,None,None,100000,100000],7:[100,1000,10000,500,10000],8:[None,10000,None,100000,100000],9:[250000,500000,None,100000,1000000],10:[10000000,1000000,None,10000000,10000000],11:[None,20000000,None,20000000,20000000],12:[50000000,50000000,100000,50000000,50000000]}
    dens={5:[10,100,120,120,1000],6:[60,10000,1000,100000,1000],7:[1,1,1,100,300],8:[60,10000,120,1000,1000],9:[1,1,180,100000,2000],10:[1,1,360,100000000,10000],11:[100000,1,720,10000,100000],12:[1,1000000,1440,100000,1000000]}
    m=Mix(g,l,lims[g][l-1],dens.get(g,[1]*5)[l-1],{(5,1):1,(5,2):2,(6,2):4,(8,2):4,(9,4):5,(10,4):8}.get((g,l)))
    add=m.add
    if (g,l)==(1,5):add('tens',S(A('a','b'),'c'),dict(a=ints(10,90,10),b=ints(1,9),c=ints(1,9)),lambda a,b,c:c<=b);m.exhaustive=True
    elif g==2:
        if l in (1,2):
            R=ints(1,30 if l==1 else 99);gr=dict(a=R,b=R,c=R)
            if l==1:add('no-regroup',S(A('a','b'),'c'),gr,lambda a,b,c:not carry(a,b) and not borrow(a+b,c))
            else:
                add('carry-or-borrow',S(A('a','b'),'c'),gr,lambda a,b,c:carry(a,b) or borrow(a+b,c))
                add('borrow-or-carry',A(S('a','b'),'c'),gr,lambda a,b,c:a>=b and (borrow(a,b) or carry(a-b,c)))
        if l>=3:
            fac=[2,5,10] if l<5 else [2,3,4,5,10];fact=ints(0,12 if l==4 else 10);tail=ints(0,20)
            gr=dict(a=fac,b=fact,c=tail)
            if l==3:
                add('multiply-add',A(M('a','b'),'c'),gr)
                add('add-subtract',S(A('a','b'),'c'),dict(a=ints(10,99),b=ints(10,99),c=tail))
            else:
                add('multiply-subtract',S(M('a','b'),'c'),gr)
                for f in fac:add('divide-add',A(Q('a',str(f)),'c'),dict(a=multiples(0,int(f)*int(fact[-1]),int(f)),c=tail))
                if l==5:
                    add('multiply-add',A(M('a','b'),'c'),gr)
                    add('compensate',S(A('a','b'),'c'),dict(a=ints(10,290,10),b=ints(10,199),c=ints(10,190,10)))
    elif g==3:
        if l in (1,2):
            lo,hi=(0,10) if l==1 else (11,39);f=ints(1 if l==1 else 2,10 if l==1 else 9)
            gr=dict(a=ints(lo,hi),b=f,c=ints(0 if l==1 else 1,20 if l==1 else 40))
            add('product-plus',A(M('a','b'),'c'),gr,lambda a,b,c:l==1 or a*b<=300)
            if l==2:add('product-minus',S(M('a','b'),'c'),gr,lambda a,b,c:a*b<=300)
            for v in f:
                d=dict(a=ints(lo*int(v),hi*int(v),int(v)),c=gr['c'])
                add('quotient-minus',S(Q('a',v),'c'),d)
                if l==2:add('quotient-plus',A(Q('a',v),'c'),d)
        if l==3:
            add('tens-product',S(M('a','b'),'c'),dict(a=ints(10,90,10),b=ints(2,12),c=ints(1,101)))
            add('compensate',A(S('a','b'),'c'),dict(a=ints(150,900),b=anchors(1,149,10,[-1,1]),c=ints(1,90)))
        if l==4:
            add('group-sum',M(A('a','b'),'c'),dict(a=ints(10,99),b=ints(1,50),c=ints(2,9)))
            add('product-difference',S(M('a','b'),'c'),dict(a=ints(12,99),b=ints(2,9),c=ints(1,199)))
        if l==5:
            add('sum-product',M(A('a','b'),'c'),dict(a=ints(12,99),b=ints(1,29),c=ints(2,12)))
            for f in [2,3,4,5,6,8,10]:
                add('quotient-plus-product',A(Q('a',str(f)),M('b','c')),dict(a=ints(f,99*f,f),b=ints(2,50),c=ints(2,12)))
    elif g==4:
        f=[(10,100),(11,12,15,20),(25,50),(9,19,99),(12,15,20,24,25,50,99,100,125)][l-1]
        for k in f:
            gr=dict(a=ints(10,99,2 if l==3 else 1),c=ints(1,150))
            add('product-minus',S(M('a',str(k)),'c'),gr)
            add('quotient-plus',A(Q('a',str(k)),'c'),dict(a=ints(k*10,k*99,k*(2 if l==3 else 1)),c=gr['c']))
            if l>=4:
                add('group-and-scale',A(M(A('a','b'),str(k)),'c'),dict(a=gr['a'],b=ints(1,19),c=gr['c']))
            if l==5:
                add('group-and-divide',A(Q(M('a',str(k)),'b'),'c'),dict(a=gr['a'],b=[2,3,4,5,10],c=gr['c']))
    elif (g,l) in [(5,1),(5,2),(6,2)]:
        dp=1 if (g,l)==(5,1) else 2
        h=99.9 if dp==1 else 49.99 if g==5 else 100
        f=[2,5,10,100] if dp==1 else [2,4,5,10,100] if g==5 else F6
        for k in f:
            arr=grid(0,h,dp);gr=dict(a=arr,c=grid(0,20,dp))
            add('decimal-product',S(M('a',str(k)),'c'),gr)
            add('decimal-quotient',A(Q('a',str(k)),'c'),dict(a=unique(decimal(val(n)*val(str(k))) for n in arr if val(decimal(val(n)*val(str(k)))).denominator in ([1,2,5,10] if dp==1 else [1,2,4,5,10,20,25,50,100])),c=gr['c']))
    elif (g,l) in [(5,3),(5,4),(6,1),(8,1)]:
        for den in D:
            for e in ([den] if (g,l)==(5,3) else [den,2*den] if 2*den in D else [den]):
                a=fractions([den],2 if g>=6 else 1,g==8);b=fractions([e],2 if g>=6 else 1,g==8)
                gr=dict(a=a,b=b,c=ints(2,12))
                add('combine-fractions',M(A('a','b'),'c'),gr)
                add('divide-sum',Q(S('a','b'),'c'),gr)
                if g==8:add('fraction-transfer',S(Q(A('a','b'),'c'),'d'),dict(**gr,d=fractions([den],1,True)))
    elif (g,l) in [(5,5),(6,3),(11,1),(12,2)]:
        ds=D2 if g<11 else [4,8,16,32]+([64] if g==12 else [])
        for den in ds:
            gr=dict(a=fractions([den],2,False),b=unique(decimal(F(n,den)) for n in range(1,2*den)),c=ints(2,100 if g<=6 else 500,2))
            if g==12:
                add('convert-and-scale',Q(M(A('a','b'),'c'),'10'),gr)
                add('convert-scale-subtract',S(Q(M(A('a','b'),'c'),'10'),'d'),dict(**gr,d=[1,2,5,10,25]))
            else:
                t=M(A('a','b'),'c');add('convert-and-scale',t,gr)
                add('convert-and-adjust',S(t,'d'),dict(**gr,d=ints(1,30)))
                if g==11:add('convert-scale-transfer',Q(S(t,'d'),'10'),dict(**gr,d=ints(1,30)))
    elif (g,l)==(6,4):
        gr=dict(a=pairings(400),b=[12,15,24,25,32,48,50,75,125],c=[2,4,8,16])
        add('regroup-factors',Q(M('a','b'),'c'),gr,lambda a,b,c:(a*b)%c==0)
        add('regroup-adjust',A(Q(M('a','b'),'c'),'d'),dict(**gr,d=grid(0,20,1)),lambda a,b,c,d:(a*b)%c==0)
    elif (g,l) in [(6,5),(7,4),(7,5),(8,5)]:
        lo=0 if g==6 else -50
        gr=dict(a=grid(lo,50,1),b=fractions([2,4,5,8],2,g>=7),c=unique([2,4,5,8,10,25] if g==6 else [-12,-8,-5,-2,2,4,5,8,10,25]))
        t=M(A('a','b'),'c')
        if (g,l)!=(8,5):add('group-multiply',t,gr)
        if (g,l)!=(7,4):
            adj=dict(**gr,d=grid(0,10,1))
            add('group-multiply-adjust',S(t,'d'),adj)
            add('group-multiply-divide',Q(S(t,'d'),'2'),adj)
    elif g==7 and l in (1,2,3):
        if l==3:
            gr=dict(a=[-99,-19,-9,9,19,99],b=ints(-75,75),c=ints(-10,10))
            add('near-base-factor',A(M('a','b'),'b'),dict(a=gr['a'],b=gr['b']))
            add('compensate-transfer',S(A(M('a','b'),'b'),'c'),gr)
        else:
            n=10 if l==1 else 40;gr=dict(a=ints(-n,n),b=ints(-n,n),c=ints(-n,n))
            add('signed-groups',M(A('a','b'),'c'),gr,lambda a,b,c:min(a,b,c)<0)
            add('signed-product',A('a',M('b','c')),gr,lambda a,b,c:min(a,b,c)<0)
            if l==2:add('signed-transfer',S(M(A('a','b'),'c'),'b'),gr,lambda a,b,c:min(a,b,c)<0)
    elif (g,l) in [(8,2),(9,4),(10,4)]:
        ys={(8,2):['-2.5','-1.25','-0.5','0.25','1.25','2.5'],(9,4):signed(F9),(10,4):signed(FA)}[g,l]
        gr=dict(a=grid(-50,50,1),b=ys,c=['0.1','0.5',2,10])
        t=Q(M('a','b'),'c')
        add('scale-quotient',t,gr)
        add('scale-adjust',A(t,'d'),dict(**gr,d=grid(-10,10,2)))
        if g>=9:add('scale-transfer',M(A(t,'d'),'2'),dict(**gr,d=grid(-10,10,2)))
    elif (g,l) in [(8,3),(9,3),(10,3),(11,3),(12,3)]:
        ds=[3,4,5,6,8,9,10,12,15,18,20,24]
        gr=dict(a=fractions(ds,2,True),b=fractions(ds,2,True),c=fractions([2,3,4,5,6],1,True),d=ints(2,24))
        n=2 if g>=11 else 1
        p=lambda a,b,**_:cross(a,b)>=n
        t=A(M('a','b'),'c')
        if g<=10:add('cancel-combine',t,{k:gr[k] for k in 'abc'},p)
        u=M(t,'d')
        add('cancel-combine-scale',u,gr,p)
        if g>=9:add('cancel-combine-transfer',Q(u,'2'),gr,p)
        if g==12:add('cancel-combine-extend',S(Q(u,'2'),'1/2'),gr,p)
    elif (g,l) in [(8,4),(9,2),(10,1)]:
        gr=dict(a=ints(8,400,8),b=[16,32,64,125,250] if g==9 else [10,100,125,1000] if g==10 else F8,c=[2,4,8,16])
        t=Q(M('a','b'),'c')
        add('pair-factors',t,gr)
        add('regroup-adjust',A(t,'d'),dict(**gr,d=ints(5,250,5)))
        if g!=9:add('regroup-transfer',M(A(t,'d'),'2'),dict(**gr,d=ints(5,250,5)))
    elif (g,l) in [(9,1),(11,2),(12,1)]:
        bs=[100,1000] if g==9 else [100,1000,10000] if g==11 else [1000,10000]
        for base in bs:
            for delta in (1,2) if g!=9 else (1,):
                gr=dict(a=ints(10,190 if g==9 else 950),b=ints(1,50))
                # (base-delta)*a + delta*a, with delta=1 kept as an actual single leaf.
                t=A(M(str(base-delta),'a'),'a') if delta==1 else A(M(str(base-delta),'a'),M(str(delta),'a'))
                add('near-base-adjust',t,dict(a=gr['a']))
                if delta==1 or g!=9:add('near-base-transfer',S(t,'b'),gr)
                if delta==1 and g!=9:add('near-base-scale',M(S(t,'b'),'2'),gr)
    elif (g,l) in [(10,2),(11,4)]:
        if g==10:
            t=S(M('a','b'),M('a','c'))
            gr=dict(a=ints(10,199),b=anchors(10,200,10,[-2,-1,1,2]),c=ints(1,9))
            add('distribute',M('a',S('b','c')),gr)
        else:
            t=A(M('a','b'),M('c','b'));gr=dict(a=ints(10,200),b=[25,50,125,'3.125'],c=ints(5,195,5))
        add('regroup-products',t,gr)
        add('regroup-products-adjust',S(t,'d'),dict(**gr,d=ints(10,300,10)))
        if g==11:add('regroup-products-transfer',Q(S(t,'d'),'2'),dict(**gr,d=ints(10,300,10)))
    else:
        # Two separate affordances: a near-base factor and a grouped
        # compensating multiple of the other factor. Also exercise power scaling.
        maxops={(9,5):4,(10,5):5,(11,5):5,(12,4):5,(12,5):6}[g,l]
        minops=4 if (g,l)==(12,4) else 3
        for base in (100,1000,10000) if g>=11 else (100,1000):
            gr=dict(a=ints(2,400),b=[5,10,25,125])
            t=Q(A(M(str(base-1),'a'),'a'),'b')
            for ops in range(3,maxops+1):
                if ops==4:t=S(t,'c');gr['c']=ints(1,100)
                if ops==5:t=M(t,'0.125' if g>=11 else '2')
                if ops==6:t=A(t,'1/8')
                if ops>=minops:add('compensate-regroup-'+str(ops),t,dict(gr))
    assert m.shapes,(g,l)
    return m
