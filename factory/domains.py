"""Finite operand grids. Strings retain authored representation, Fractions retain value."""
from fractions import Fraction as F
from functools import lru_cache
from math import gcd, lcm
from random import Random
import hashlib, itertools

def seeded(key):
    return Random(int.from_bytes(hashlib.sha256(str(key).encode()).digest(), 'big'))

@lru_cache(maxsize=90000)
def val(x):
    return F(x)

def decimal(x, places=None):
    v=F(x)
    if places is None:
        places=0
        den=v.denominator
        while den>1:
            if den%2 and den%5: return str(v)
            den//=gcd(den,10)
            places+=1
        if places>8:return str(v)  # exact literal fraction within the AST display contract
    scaled=v*10**places
    if scaled.denominator!=1: return str(v)
    n=abs(scaled.numerator)
    if not places:return str(v.numerator)
    return ('-' if v<0 else '')+f'{n//10**places}.{n%10**places:0{places}d}'

def unique(xs):
    return tuple(dict.fromkeys(map(str,xs)))

def ints(a,b,step=1):
    return unique(range(a,b+1,step))

def subset(xs,key,size=700):
    if len(xs)<=size:return xs
    r=seeded(key)
    return tuple(dict.fromkeys([xs[0],xs[-1],*r.sample(xs,size-2)]))

def grid(lo,hi,places=0,step=1):
    scale=10**places
    nums=range(int(F(str(lo))*scale),int(F(str(hi))*scale)+1,step)
    return unique(decimal(F(n,scale),places) for n in subset(nums,(lo,hi,places,step),1300))
def fractions(ds,mag=1,signed=False,positive=False,cap=None):
    return unique(f'{m}/{d}' for d in ds for m in subset(range(max(-mag*d,-cap) if signed and cap else -mag*d if signed else int(positive),min(mag*d,cap) +1 if cap else mag*d+1),(d,mag,signed,cap),80))
def signed(xs):
    return unique([*xs,*('-'+str(x) for x in xs if val(str(x))>0)])
def anchors(lo,hi,base,deltas,places=0):
    n=range(int(F(str(lo))/base)-1,int(F(str(hi))/base)+2)
    return unique(decimal(v,places) for k in subset(n,(lo,hi,base),220) for delta in deltas if lo<=(v:=k*base+delta)<=hi)
def multiples(lo,hi,s):
    return grid(((lo+s-1)//s)*s,(hi//s)*s,0,s)
def complementary(a,b,op,anchors_):
    return (a+b if op=='ADD' else a-b) in anchors_
def cross(a,b,division=False):
    if division:
        if not b:return 0
        b=1/b
    return int(gcd(abs(a.numerator),b.denominator)>1)+int(gcd(abs(b.numerator),a.denominator)>1)
def carry(a,b):
    return int(a)%10+int(b)%10>=10
def borrow(a,b):
    return int(a)%10<int(b)%10

D=(2,3,4,5,6,8,10,12)
D2=(2,4,5,8,10)
D3=(2,4,5,8,10,20,25)
HIGH=(2,4,5,8,10,16,20,25,32,40,50,80,100,125)
F5=unique(['0.25','0.5','0.75','1.25','2.5','12.5',25,125])
F6=unique(['0.1','0.2','0.25','0.5','2.5',5,10,100])
F8=unique(['0.125','0.25','0.5','1.25','2.5','12.5',25,125])
F9=unique(['0.99','1.01','9.9','10.1','99.9','100.1'])
FA=unique(['0.001','0.01','0.1','0.0625','0.125','0.25','1.25','12.5',1000])
FB=unique(['0.03125','0.0625','0.125','0.375','0.625','1.25','3.125','6.25','12.5','62.5'])
FC=unique(['0.015625','0.03125','0.0625','0.125','0.375','1.25','3.125','12.5',125,250])
SIMPLE=unique(['1/8','1/4','1/2','3/4','3/8','5/8','0.125','0.25','0.5',25,125])
FRIEND=unique([*SIMPLE,16,32,64,250,'1.25','2.5','3.125','12.5','0.03125'])

def pairings(limit):
    return unique(n for n in range(10,limit+1) if n%2==0 or n%5==0)
def offsets(n,p=0):
    return [F(j,10**p) for j in range(-n,n+1) if j]
def absrate(v):return str(v)
def leafden(token):return int(token.split('/')[1]) if '/' in token else val(token).denominator

class Domain:
    """Each branch is a finite left × right rectangle plus an exact predicate.
    In inverse branches, left represents the quotient and right the divisor.
    """
    def __init__(self,g,l,op):
        self.g,self.l,self.op=g,l,op
        self.branches=[]
        self.lookups=[]
        self.exhaustive=False
    def add(self,left,right,predicate=None,*,inverse=False,name='base'):
        left,right=unique(left),unique(right)
        self.branches.append((left,right,predicate,inverse,name))
        inverse_values={}
        if inverse:
            for item in left:inverse_values.setdefault(val(item),[]).append(item)
        self.lookups.append((frozenset(left),frozenset(right),inverse_values,predicate,inverse))
    def candidates(self):
        for k,(left,right,pred,inverse,name) in enumerate(self.branches):
            size=len(left)*len(right)
            rng=seeded((self.g,self.l,self.op,k))
            step=rng.randrange(1,max(2,size))
            while gcd(step,size)!=1:step+=1
            start=rng.randrange(size)
            def stream(left=left,right=right,pred=pred,inverse=inverse,size=size,start=start,step=step,name=name):
                for i in range(size):
                    n=(start+i*step)%size
                    a,b=left[n//len(right)],right[n%len(right)]
                    x,y=val(a),val(b)
                    if pred and not pred(x,y,a,b):continue
                    if self.op=='DIV' and not y:continue
                    if inverse:a=decimal(x*y)
                    yield (self.op,a,b),name
            yield stream()
    def accept(self,tree):
        if tree[0]!=self.op or not isinstance(tree[1],str) or not isinstance(tree[2],str):return False
        a,b=tree[1:]; x,y=val(a),val(b)
        if self.op=='DIV' and not y:return False
        for left,right,inverse_values,pred,inverse in self.lookups:
            if b not in right:continue
            if inverse:
                q=x/y
                for s in inverse_values.get(q,()):
                    if not pred or pred(q,y,s,b):return True
            elif a in left and (not pred or pred(x,y,a,b)):return True
        return False

@lru_cache(maxsize=48)
def membership(xs):return frozenset(xs)
@lru_cache(maxsize=24)
def byvalue(xs):
    out={}
    for s in xs:out.setdefault(val(s),[]).append(s)
    return out

def addition(g,l,op):
    d=Domain(g,l,op); plus=op=='ADD'
    def add(x,y,p=None,name='base'):
        d.add(x,y,lambda a,b,s,t:(g>=7 or plus or a>=b) and (not p or p(a,b,s,t)),name=name)
    def within(x,y,total=None,name='base'):
        add(x,y,(lambda a,b,s,t:a+b<=total) if plus and total is not None else None,name)
    if g==1:
        d.exhaustive=True
        if l<=2:
            n=(5,10)[l-1]; within(ints(0,n),ints(0,n),n)
        if l==3:add(ints(10,19),ints(0,9),lambda a,b,*_:a+b<=19 if plus else a-b>=10)
        if l==4:add(ints(1,9) if plus else ints(10,18),ints(1,9),lambda a,b,*_:a+b>=10 if plus else a-b<10)
        if l==5:
            if plus:within(ints(10,90,10),unique([*ints(0,9),*ints(10,90,10)]),100)
            else:add(ints(10,100),ints(0,90),lambda a,b,*_:b%10==0 or b<=a%10)
    elif g==2:
        if l==1:add(ints(10,89 if plus else 99),ints(10,89 if plus else 99),lambda a,b,*_:a//10+b//10<=9 and not carry(a,b) if plus else a//10>=b//10 and not borrow(a,b))
        if l==2:add(ints(10,89 if plus else 99),ints(10,89 if plus else 99),lambda a,b,*_:carry(a,b) and a+b<=100 if plus else borrow(a,b))
        if l==3:add(ints(10,99) if plus else ints(0,150),ints(10,99) if plus else ints(0,150),lambda a,b,*_:a+b<=150 if plus else a-b<=100)
        if l==4:
            within(ints(10,190,10) if plus else ints(0,300),ints(10,199) if plus else ints(0,300,10),300)
            if not plus:add(ints(0,300,10),ints(0,300),name='multiple-minuend')
        if l==5:within(ints(10,299) if plus else ints(0,500),unique(v for v in range(10 if plus else 0,300 if plus else 501) if v%10 in (0,1,9)),500)
    elif g in (3,4):
        upper=([999,999,999,999,1999] if g==3 else [9999,9999,9999,9999,20000])[l-1]
        lo=([0,10,10,100,100] if g==3 else [100]*5)[l-1]
        cap=([1000,1500,2000,1800,3000] if g==3 else [15000,15000,20000,20000,30000])[l-1]
        low,high=(lo,upper) if plus else (0,cap)
        a=grid(low,high)
        if g==3:
            b=[lambda: multiples(low,high,100),lambda:multiples(low,high,10),lambda:anchors(low,high,10,[-2,-1,1,2]),lambda:a,lambda:anchors(low,high,100,offsets(5))][l-1]()
        else:
            b=[lambda:multiples(low,high,100),lambda:anchors(low,high,100,offsets(10)),lambda:multiples(low,high,25),lambda:anchors(low,high,1000,offsets(20)),lambda:unique([*multiples(low,high,10),*anchors(low,high,100,offsets(10))])][l-1]()
        within(a,b,cap)
    elif (g,l)==(5,1):within(grid(0,99.9 if plus else 150,1),grid(0,99.9 if plus else 150,1),150)
    elif (g,l)==(5,2):
        high=99.99 if plus else 150
        within(grid(0,high,2),anchors(0,high,1,[F(25,100),F(50,100),F(75,100),F(99,100)],2),150)
    elif (g,l) in [(5,3),(5,4),(6,1),(8,1),(8,3),(9,3),(10,3),(11,3),(12,3)]:
        cap={(5,3):12,(5,4):12,(6,1):60,(8,1):60,(8,3):120,(9,3):180,(10,3):360,(11,3):720,(12,3):1440}[g,l]
        dens=D if g<=8 and l!=3 or g==5 else [*D,*range(9,{8:24,9:60,10:120,11:180,12:360}[g]+1)]
        if g==5 or (g,l) in [(6,1),(8,1)]:pairs=[(u,v) for u in dens for v in dens if (u==v if (g,l)==(5,3) else max(u,v)%min(u,v)==0 if (g,l)==(5,4) else lcm(u,v)<=cap)]
        else:pairs=[(u,v) for u in dens for v in dens if gcd(u,v)>1 and lcm(u,v)<=cap]
        pairs=subset(pairs,(g,l,'den'),32) if g>=8 else pairs
        mag=1 if g==5 and (l==4 or plus) else 2 if g<=8 and l!=3 or g==5 else {8:10,9:20,10:100,11:50,12:100}[g]
        for u,v in pairs:
            add(fractions([u],mag,g>=7),fractions([v],mag,g>=7),name='like' if u==v else 'related')
        d.exhaustive=g==5 and l==3
    elif (g,l) in [(5,5),(6,3)]:
        a=fractions(D2 if g==5 else D3,100)
        b=grid(0,100,3)
        add(a,b,name='fraction-decimal')
        if op=='SUB' or g==5:add(b,a,name='decimal-fraction')
    elif (g,l)==(6,2):
        high=999.999 if plus else 1000
        within(grid(0,high,3),anchors(0,high,1,[F(x,1000) for x in (125,250,500,750,875,1,-1,5,-5)],3),1000)
    elif (g,l)==(6,4):
        within(grid(0,10000,2),anchors(0,10000,10,offsets(100,2),2))
    elif (g,l) in [(7,1),(7,2),(7,3),(9,1),(9,2),(10,1),(11,2),(12,1)]:
        limit={(7,1):50,(7,2):200,(7,3):1000,(9,1):10000,(9,2):100000,(10,1):1000000,(11,2):1000000,(12,1):10000000}[g,l]
        a=grid(-limit,limit)
        b={(7,1):lambda:a,(7,2):lambda:anchors(-limit,limit,10,offsets(2)),(7,3):lambda:anchors(-limit,limit,100,offsets(5)),(9,1):lambda:anchors(-limit,limit,100,offsets(10)),(9,2):lambda:multiples(-limit,limit,125),(10,1):lambda:unique([*multiples(-limit,limit,1000),*anchors(-limit,limit,100000,offsets(20))]),(11,2):lambda:anchors(-limit,limit,1000,offsets(50)),(12,1):lambda:anchors(-limit,limit,100000,offsets(100))}[g,l]()
        add(a,b,lambda x,y,*_:g!=7 or min(x,y)<0,name='anchor')
        if (g,l)==(12,1):
            for target in [100,1000,10000,100000,1000000]:
                for delta in (25,125,250,500,750):
                    add([str(target-delta if plus else target+delta)],[str(delta)],name='complement')
    elif (g,l) in [(8,2),(8,4),(9,4),(10,2)]:
        limit={(8,2):100,(8,4):200,(9,4):1000,(10,2):100000}[g,l]
        p=2 if g==10 else 3
        a=grid(-limit,limit,p)
        if (g,l)==(8,2):b=anchors(-limit,limit,1,[F(x,1000) for x in (0,125,-125,375,500,625,875)],3)
        elif (g,l)==(8,4):b=anchors(-limit,limit,1,[F(x,y) for x in (1,-1) for y in (2,4,5,8,10,16)],4)
        elif g==9:b=unique(decimal(sign*base+diff,3) for base in (1,10,100,1000) for sign in (1,) for diff in offsets(250,3) if abs(sign*base+diff)<=limit)
        else:b=anchors(-limit,limit,1000,[F(x,100) for x in (-1000,-500,-125,-50,-1,1,50,125,500,1000)],2)
        add(a,b,name='near-anchor')
    elif (g,l) in [(10,4),(11,4),(12,4)]:
        mag={10:10000,11:100000,12:1000000}[g]
        ds=(2,4,5,8,10,16) if g==10 else (2,4,5,8,10,16,20,25,32)
        for den in ds:
            for rem in range(1,den):
                b=decimal(F(rem,den))
                # For every pair the sum/difference reaches the named integer endpoint.
                ks=subset(range(-mag+1,mag), (g,den,rem),120)
                a=unique(decimal(k-val(b) if plus else k+val(b)) for k in ks)
                add(a,[b],name='complement')
        if g==10:add(grid(-mag,mag,4),unique(signed([1,10,100,1000,10000])),name='power-ten')
    elif (g,l) in [(11,1),(12,2)]:
        ds=HIGH if g==11 else (2,4,5,8,10,16,20,25,32,40,50,64,100,125,250)
        mag=1000 if g==11 else 100000
        for den in ds:
            a=fractions([den],mag,True)
            for ed in [den,ds[(ds.index(den)+1)%len(ds)]]:
                b=fractions([ed],mag,True)
                add(a,b,name='fraction')
                add(unique(decimal(val(t)) for t in a if g==11 or 100000%val(t).denominator==0),b,name='equivalence')
    else:
        mag,cap,dp,ds={(6,5):(1000,1000,3,D),(7,4):(50,100,2,D2),(7,5):(500,300,2,D),(8,5):(500,1000,3,D3),(9,5):(10000,2000,3,D3),(10,5):(100000,10000,4,D3),(11,5):(100000,100000,5,HIGH),(12,5):(10000000,1000000,6,HIGH)}[g,l]
        low=0 if g==6 else -mag
        a=unique([*grid(low,mag,dp),*fractions(ds,mag,g>=7),*grid(low,mag)])
        b=a if g<=8 else unique([*signed([1,10,100,1000]),*anchors(low,mag,100,[F(x,8) for x in (-2,-1,1,2)],3)])
        add(a,b,lambda x,y,*_:lcm(x.denominator,y.denominator)<=cap and (g!=7 or min(x,y)<0),name='mixed-representation')
    return d
def multiplication(g,l,op):
    d=Domain(g,l,op); div=op=='DIV'
    def add(x,y,p=None, inverse=None,name='factor'):
        d.add(x,y,p,inverse=div if inverse is None else inverse,name=name)
    def neg(x,y,*_):return min(x*y if div else x,y)<0
    if g<=4:
        if g==2:
            b={3:[2,5,10],4:[2,5,10],5:[2,3,4,5,10]}[l]
            x=ints(0,12 if l==4 else 10)
            d.exhaustive=True
            if div:add(x,b)
            else:
                add(b,x)
                if l==3:add(x,b,name='commuted')
        if g==3:
            if l==1:add(ints(0,10),ints(1 if div else 0,10))
            if l==2:add(ints(11,39),ints(2,9),lambda x,y,*_:div or x*y<=300)
            if l==3:add(ints(10,90,10),ints(2,10 if div else 12))
            if l in (4,5):
                preferred=(2,4,5,8,9) if l==4 else (5,10,11,12)
                add(ints(12 if l==4 else 10,99),ints(2,9 if l==4 else 12),lambda x,y,*_:x%10 in (0,1,2,8,9) or y in preferred)
            d.exhaustive=True
        if g==4:
            ys={1:(10,100),2:(11,12,15,20),3:(25,50),4:(9,19,99),5:(12,15,20,24,25,50,99,100,125)}[l]
            a=({1:1,2:10,3:2,4:10,5:10} if div else {1:10,2:10,3:4,4:10,5:10})[l]
            b={1:999,2:99,3:400,4:99,5:250}[l]
            add(ints(a,b,2 if l==3 else 1),ys,lambda x,y,*_:l!=5 or x*y<=30000)
            d.exhaustive=True
    elif (g,l) in [(5,1),(5,2),(6,2),(8,2),(9,4),(10,4)]:
        hi={(5,1):99.9,(5,2):49.99,(6,2):100,(8,2):100,(9,4):200,(10,4):1000}[g,l]
        ys={(5,1):[2,5,10,100],(5,2):[2,4,5,10,100],(6,2):F6,(8,2):unique([-10,'-2.5','-1.25','-0.5','-0.25','0.25','0.5','1.25','2.5',10,100]),(9,4):signed(F9),(10,4):signed(FA)}[g,l]
        dp={(5,1):1,(5,2):2,(6,2):2,(8,2):2,(9,4):2,(10,4):3}[g,l]
        add(grid(0 if g<=6 else -hi,hi,dp),ys)
    elif (g,l)==(5,3):
        add(fractions(D,2 if div else 1,False,True),ints(2,5 if div else 10),inverse=False);d.exhaustive=True
    elif (g,l)==(5,4):
        for den in range(1,13):
            if div:
                add(ints(1,60),fractions([den],1,False,True),lambda x,y,s,t:x%int(t.split('/')[0])==0,inverse=False)
            else:add(fractions([den],1,False,True),multiples(2,60,den))
        d.exhaustive=True
    elif (g,l)==(5,5):
        if div:add(ints(2,160),F5)
        else:add(F5,ints(2,160,2))
        d.exhaustive=True
    elif (g,l) in [(6,1),(8,1),(8,3),(9,3),(10,3),(11,3),(12,3)]:
        if (g,l) in ((6,1),(8,1)):
            ds=D if g==6 else range(1,13)
            xs=fractions(ds,2 if g==6 else 3,g>=7,True)
            add(xs,xs,lambda x,y,*_:bool(y) and ((x/y).denominator<=60 if div else cross(x,y)>0 or (x*y).denominator<=60),inverse=False,name='fraction')
        else:
            cap={8:48,9:120,10:250,11:500,12:1000}[g]
            maxd={8:120,9:180,10:360,11:720,12:1440}[g]
            # Structured cross-products use reduced pairs; reject hidden cancellations
            # within a literal before counting a cross-factor opportunity.
            for h,k in [(2,3),(3,5),(4,5),(5,7),(7,9),(8,11),(3,11),(7,13)]:
                a=unique(str(F(sign*h*n,k*m)) for n in range(1,min(cap//h,22)+1) for m in range(1,min(cap//k,22)+1) for sign in (-1,1))
                b=unique(str(F(h*n,k*m) if div else F(k*m,h*n)) for n in range(1,min(cap//h,24)+1) for m in range(1,min(cap//k,24)+1))
                a=unique(t if '/' in t else t+'/1' for t in a)
                b=unique(t if '/' in t else t+'/1' for t in b)
                add(a,b,lambda x,y,*_:cross(x,y,div)>=(2 if g>=11 else 1) and (x/y if div else x*y).denominator<=maxd,inverse=False,name='cross-cancel')
    elif (g,l)==(6,3):
        for den in D3:
            fs=fractions([den],2,False,True)
            if div:add(ints(1,200),fs)
            else:add(fs,multiples(1,400,den))
        d.exhaustive=True
    elif (g,l)==(6,4):
        add(ints(10,400),[12,15,24,25,32,48,50,75,125],lambda x,y,*_:x%2==0 and (y%5==0 or y%2==0) or x%5==0 and y%2==0)
    elif (g,l) in [(6,5),(7,5),(8,5),(9,5),(10,5),(11,4),(11,5),(12,4),(12,5)]:
        mag={(6,5):500,(7,5):100,(8,5):500 if div else 200,(9,5):1000,(10,5):10000,(11,4):10000,(11,5):10000,(12,4):100000,(12,5):100000}[g,l]
        ys=SIMPLE if g==6 else signed(FRIEND)
        if g in (7,8) and not div:ys=unique(t for t in ys if abs(val(t))<=mag)
        if g>=9 and (g,l) not in [(11,4),(11,5)]:
            ys=unique([*ys,*signed([99,101,199,999,1001])])
        ds=[2,3,4,5,6,8,10,12] if g<=8 else [2,3,4,5,8,10,12,16,20,24,25,32,40,50,64]
        xs=unique([*grid(0 if g==6 else -mag,mag),*fractions(ds,mag,g>=7)])
        cap={(6,5):1000,(7,5):300,(8,5):1000,(9,5):2000,(10,5):10000,(11,4):10000,(11,5):100000,(12,4):100000,(12,5):1000000}[g,l]
        if (g,l)==(11,4) and div:xs=grid(-mag,mag,3)
        if (g,l)==(12,4) and not div:
            xs=anchors(-mag,mag,100,[-2,-1,1,2]);ys=signed([25,125,250,'0.125','0.25'])
        if (g,l)==(8,5) and div:
            add(xs,ys,lambda x,y,*_:x and (x/y).denominator<=cap,inverse=False)
        else:
            add(xs,ys,lambda x,y,*_:(x*y).denominator<=cap and (g!=7 or neg(x,y)) and (g<12 or abs(x*y)<=50000000))
        # Additional independent rational-cancellation subfamily on cells allowing it
        if not div and (g,l) in [(8,5),(9,5),(10,5),(12,5)]:
            a=fractions([3,5,7,9,11],2,True,True); b=fractions([4,6,8,10,12],3,True,True)
            add(a,b,lambda x,y,*_:cross(x,y)>0 and (x*y).denominator<=cap,inverse=False,name='cross-cancel')
    elif g==7 and l in (1,2,3):
        mag=10 if l==1 else 99
        y={1:ints(-10,10),2:[-10,-5,-2,2,5,10],3:[-99,-19,-9,9,19,99]}[l]
        add(ints(-mag,mag),y,neg);d.exhaustive=True
    elif (g,l)==(7,4):
        add(fractions(range(1,11),20 if div else 50,True),signed(ints(1,20 if div else 40)),neg)
    elif (g,l)==(8,4):
        add(grid(-800,800) if div else fractions(D2,200,True),signed(F8))
    elif (g,l) in [(9,1),(9,2),(10,1),(10,2),(11,2),(12,1)]:
        lo,hi={(9,1):(10,200),(9,2):(2,500),(10,1):(0 if div else 10,10000),(10,2):(10,999),(11,2):(10,2000),(12,1):(10,5000)}[g,l]
        ys={(9,1):(99,101,999,1001),(9,2):(16,32,64,125,250),(10,1):(10,100,1000,16,25,32,64,125) if div else (10,100,1000,25,50,125),(10,2):[k+i for k in (10,100,1000) for i in offsets(5)],(11,2):[k+i for k in (100,1000,10000) for i in offsets(10)],(12,1):[k+i for k in (1000,10000) for i in offsets(20)]+([25,125,250] if div else [])}[g,l]
        cap={(9,1):250000,(9,2):500000,(10,1):10000000,(10,2):1000000,(11,2):20000000,(12,1):50000000}[g,l]
        add(signed(grid(lo,hi)),signed(ys) if (g,l)==(9,1) else ys,lambda x,y,*_:abs(x*y)<=cap and (div or (g,l) not in [(9,2),(10,1)] or (x*y)%10==0 or y in (16,32,64) and x%2==0))
    elif (g,l) in [(11,1),(12,2)]:
        hi=10000 if g==11 else 100000
        ys=FB if g==11 else FC
        xs=grid(-hi,hi) if div else unique([*grid(-hi,hi,2),*grid(-hi,hi,0,8)])
        add(xs,ys,lambda x,y,*_:(g==11 and div) or (x*y).denominator<=8)
    else:raise ValueError((g,l,op))
    return d

def bin_domain(g,l,op):
    return (addition if op in ('ADD','SUB') else multiplication)(g,l,op)
