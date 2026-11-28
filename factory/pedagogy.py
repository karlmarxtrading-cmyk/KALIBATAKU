"""Exact, bilingual worked examples. Each recorded step denotes the WHOLE expression."""
from contextvars import ContextVar
from fractions import Fraction
from functools import lru_cache
from math import gcd, lcm
import operator
import re

DECIMAL_STYLE = ContextVar("decimal_style", default=False)

SYMBOLS = {"ADD": "+", "SUB": "−", "MUL": "×", "DIV": "÷"}
OPS = {"ADD": operator.add, "SUB": operator.sub, "MUL": operator.mul, "DIV": operator.truediv}


def bilingual(id_text, en_text):
    return {"id": re.sub(r"(?<=\d)\.(?=\d)", ",", id_text), "en": en_text}


@lru_cache(maxsize=32768)
def value(tree):
    if isinstance(tree, tuple):
        op, left, right = tree
        return OPS[op](value(left), value(right))
    return Fraction(tree)


def rational(v):
    return {"numerator": str(v.numerator), "denominator": str(v.denominator)}


def ast(tree, display=False):
    if isinstance(tree, tuple):
        op, a, b = tree
        return {"kind": "binary", "operation": op, "left": ast(a, display), "right": ast(b, display)}
    token = str(tree)
    node = {"kind": "rational", **rational(value(token))}
    if display:
        if "/" in token:
            n, d = map(int, token.split("/"))
            node["display"] = {"kind": "fraction", "numerator": str(n), "denominator": str(d)}
        elif "." in token:
            node["display"] = {"kind": "decimal", "decimal_places": len(token.split(".")[1])}
        else:
            node["display"] = {"kind": "integer"}
    return node


def expression(tree, nested=False):
    if isinstance(tree, tuple):
        op, a, b = tree
        txt = f"{expression(a, True)} {SYMBOLS[op]} {expression(b, True)}"
        return "(" + txt + ")" if nested else txt
    text = str(tree).replace("-", "−").replace("/", "⁄")
    return "(" + text + ")" if nested and (text.startswith("−") or "⁄" in text) else text


def number(v):
    """Keep rational numerators/denominators exact and human-sized."""
    if DECIMAL_STYLE.get():
        f = Fraction(v)
        for places in range(9):
            scale = 10**places
            if scale % f.denominator == 0:
                integer = f.numerator * (scale // f.denominator)
                if not places: return expression(str(integer))
                digits = str(abs(integer)).zfill(places+1)
                return ("−" if integer < 0 else "") + digits[:-places] + "." + digits[-places:]
    return expression(str(v))


def binop(op, a, b):
    return (op, a if isinstance(a, tuple) else str(a), b if isinstance(b, tuple) else str(b))


def nearest_anchor(v):
    # Prefer a bigger place-value anchor only when its compensating offset is small.
    for step in (1000000, 100000, 10000, 1000, 100, 10, 1):
        base = round(v / step) * step
        if base and abs(v - base) and abs(v - base) <= Fraction(step, 10):
            return base
    return None


def inverse_hint(a, b, answer):
    return ("INV",
            bilingual(f"Bilangan berapa yang jika dikalikan {number(b)} menghasilkan {number(a)}?",
                      f"What number times {number(b)} gives {number(a)}?"),
            bilingual(f"Periksa dengan perkalian: {number(b)} × ({number(answer)}) = {number(a)}.",
                      f"Check by multiplication: {number(b)} × ({number(answer)}) = {number(a)}."), None)


def basic(tree, grade):
    op, la, lb = tree
    a, b, result = value(la), value(lb), value(tree)
    A, B, R = number(a), number(b), number(result)
    sign = SYMBOLS[op]

    if op in ("ADD", "SUB"):
        # Preserve the two printed denominators, including unreduced fraction notation.
        if "/" in str(la) or "/" in str(lb):
            da = int(str(la).split("/")[-1]) if "/" in str(la) else a.denominator
            db = int(str(lb).split("/")[-1]) if "/" in str(lb) else b.denominator
            d = lcm(da, db)
            na, nb = int(a*d), int(b*d)
            combined = na + nb if op == "ADD" else na - nb
            return ("FR", bilingual(f"Nyatakan kedua bilangan dalam satuan 1/{d}.",
                                    f"Express both numbers in units of 1/{d}."),
                    bilingual(f"Dengan penyebut {d}, pembilangnya {na} dan {nb}. Hitung {na} {sign} ({nb}) = {combined}, lalu sederhanakan {combined}/{d}.",
                              f"With denominator {d}, the numerators are {na} and {nb}. Compute {na} {sign} ({nb}) = {combined}, then simplify {combined}/{d}."),
                    binop("DIV", binop(op, na, nb), d))

        if b == 0 or (op == "ADD" and a == 0):
            return ("NB", bilingual("Apa yang berubah ketika kamu menambah atau mengurangi nol?",
                                    "What changes when you add or subtract zero?"),
                    bilingual("Menambah atau mengurangi nol membuat bilangannya tetap sama.",
                              "Adding or subtracting zero leaves the number unchanged."), None)
        if op == "ADD" and a >= 0 and b >= 0 and min(a,b) == 1:
            start = number(max(a,b))
            return ("NB", bilingual(f"Bilangan apa yang datang sesudah {start}?",
                                    f"Which number comes just after {start}?"),
                    bilingual(f"Satu langkah setelah {start} adalah {R}.",
                              f"One step after {start} is {R}."), None)
        if op == "SUB" and a.denominator == b.denominator == 1 and b >= 10 and 0 < result <= 10:
            bridge = (int(b) // 10 + 1) * 10
            if b < bridge < a:
                first, second = bridge-b, a-bridge
                return ("BR", bilingual(f"Mulai dari {B}. Berapa langkah ke {bridge}, lalu ke {A}?",
                                        f"Start at {B}. How far is it to {bridge}, then to {A}?"),
                        bilingual(f"Dari {B} ke {bridge} perlu {number(first)} langkah. Dari {bridge} ke {A} perlu {number(second)} lagi. Jumlahkan kedua jarak.",
                                  f"Count {number(first)} from {B} to {bridge}, then {number(second)} more to {A}. Add the two distances."),
                        binop("ADD", first, second))
            return ("INV", bilingual(f"Berapa langkah dari {B} ke {A}?", f"How far is it from {B} to {A}?"),
                    bilingual(f"Dari {B}, maju {R} langkah untuk sampai di {A}.",
                              f"From {B}, count up {R} to reach {A}."), None)

        if grade <= 2 and a >= 0 and b >= 0:
            if op == "ADD":
                if a and a == b:
                    return ("DB", bilingual(f"Ada dua kelompok berisi {A}. Coba gandakan {A}.",
                                            f"There are two groups of {A}. Try doubling {A}."),
                            bilingual(f"Dua kelompok berisi {A} menghasilkan {R}.",
                                      f"Two groups of {A} make {R}."), None)
                gap = (10 - int(a)%10)%10
                if 0 < gap <= b:
                    rest = b-gap
                    return ("MT" if a < 10 else "BR",
                            bilingual(f"Berapa lagi dari {A} ke {number(a+gap)}? Ambil bagian itu dari {B}.",
                                      f"How far is {A} from {number(a+gap)}? Take that part from {B}."),
                            bilingual(f"Tambahkan {gap} ke {A} untuk mencapai {number(a+gap)}. Dari {B} masih tersisa {number(rest)} untuk ditambahkan.",
                                      f"Add {gap} to {A} to reach {number(a+gap)}. That leaves {number(rest)} of the original {B} to add."),
                            binop("ADD", a+gap, rest))
                return ("NB", bilingual(f"Mulai dari {number(max(a,b))}. Hitung maju {number(min(a,b))} langkah.",
                                        f"Start at {number(max(a,b))} and count on {number(min(a,b))}."),
                        bilingual(f"Dari {number(max(a,b))}, maju {number(min(a,b))} langkah membawa kita ke {R}.",
                                  f"Starting at {number(max(a,b))}, moving forward {number(min(a,b))} lands on {R}."), None)
            gap = int(a)%10
            if 0 < gap < b:
                return ("BR", bilingual(f"Kurangi {A} sampai puluhan terdekat di bawahnya.",
                                        f"Subtract just enough to reach the ten below {A}."),
                        bilingual(f"Kurangi {gap} dahulu sehingga tersisa {number(a-gap)}. Lalu kurangi lagi {number(b-gap)}.",
                                  f"Subtract {gap} first to reach {number(a-gap)}. Then take away the remaining {number(b-gap)}."),
                        binop("SUB", a-gap, b-gap))
            return ("INV", bilingual(f"Mulai dari {B}. Berapa lagi untuk mencapai {A}?",
                                     f"Start at {B}. How much more reaches {A}?"),
                    bilingual(f"Jarak dari {B} ke {A} adalah {R}, karena {B} + {R} = {A}.",
                              f"The distance from {B} to {A} is {R}, since {B} + {R} = {A}."), None)

        if grade >= 3 and op == "ADD" and nearest_anchor(b) is None and nearest_anchor(a) is not None:
            return basic((op, lb, la), grade)
        if grade >= 5 and DECIMAL_STYLE.get() and (result.denominator == 1 or (a-b).denominator == 1) and (a.denominator>1 or b.denominator>1):
            if op=="SUB" and result.denominator==1:
                part=a-int(a//1)
                return ("CO", bilingual(f"Kurangi kedua bilangan dengan bagian pecahan yang sama, yaitu {number(part)}.",
                                        f"Subtract the same fractional part, {number(part)}, from both numbers."),
                        bilingual(f"Selisihnya tetap: {A} − ({B}) = {number(a-part)} − ({number(b-part)}).",
                                  f"The difference is preserved: {A} − ({B}) = {number(a-part)} − ({number(b-part)})."),
                        binop("SUB",a-part,b-part))
            if op=="ADD" and result.denominator==1:
                first=Fraction(a//1); piece=a-first
                return ("BR",bilingual(f"Pisahkan {A} menjadi bagian bulat dan sisanya. Pasangkan sisanya dengan {B}.",
                                       f"Separate {A} into a whole part and a remainder. Pair the remainder with {B}."),
                        bilingual(f"Pindahkan {number(piece)} dari operand pertama ke operand kedua. Jumlahnya tetap, dan kedua operand menjadi bilangan bulat.",
                                  f"Move {number(piece)} from the first addend to the second. Their sum stays the same and both become whole numbers."),
                        binop("ADD",first,b+piece))
        anchor = nearest_anchor(b)
        if anchor is not None and not (grade <= 6 and anchor > a and op == "SUB"):
            offset = b - anchor
            shift = offset if op == "ADD" else -offset
            part = a + anchor if op == "ADD" else a - anchor
            hint = bilingual(f"Ganti sementara {B} dengan {number(anchor)}. Tentukan arah koreksinya.",
                             f"Temporarily replace {B} with {number(anchor)}. Which way should you adjust?")
            if a >= 0 and b >= 0 and anchor > 0:
                # MATH-002: describe the correction by its size and direction; no signed numbers.
                k, Kn = abs(offset), number(abs(offset))
                rel_id = f"{B} adalah {Kn} kurang dari {number(anchor)}" if offset < 0 else f"{B} adalah {Kn} lebih dari {number(anchor)}"
                rel_en = f"{B} is {Kn} less than {number(anchor)}" if offset < 0 else f"{B} is {Kn} more than {number(anchor)}"
                if op == "ADD":
                    act_id = f"kurangi hasilnya dengan {Kn}" if offset < 0 else f"tambahkan {Kn} lagi"
                    act_en = f"take {Kn} away from the result" if offset < 0 else f"add {Kn} more"
                else:
                    act_id = f"kamu mengurangkan {Kn} terlalu banyak, jadi tambahkan kembali {Kn}" if offset < 0 else f"kurangi {Kn} lagi"
                    act_en = f"you took away {Kn} too much, so add {Kn} back" if offset < 0 else f"take away {Kn} more"
                text = bilingual(f"Ganti {B} dengan {number(anchor)}: {A} {sign} {number(anchor)} = {number(part)}. Karena {rel_id}, {act_id}.",
                                 f"Replace {B} with {number(anchor)}: {A} {sign} {number(anchor)} = {number(part)}. Because {rel_en}, {act_en}.")
                steps = [(binop("ADD" if shift >= 0 else "SUB", part, k),
                          bilingual(f"{A} {sign} {number(anchor)} = {number(part)}, lalu {'tambah' if shift >= 0 else 'kurangi'} {Kn}.",
                                    f"{A} {sign} {number(anchor)} = {number(part)}, then {'add' if shift >= 0 else 'subtract'} {Kn}."))]
                return ("CO", hint, text, steps)
            return ("CO", hint,
                    bilingual(f"Perhitungan dengan {number(anchor)} memberi {number(part)}. Selisih antara operand asli dan patokan adalah {number(offset)}. Koreksi hasil sebesar {number(shift)}.",
                              f"Using {number(anchor)} gives {number(part)}. The original operand differs from the anchor by {number(offset)}. Adjust the result by {number(shift)}."),
                    binop("ADD" if shift >= 0 else "SUB", part, abs(shift)))
        if op == "SUB" and b < 0:
            return ("SG", bilingual("Apa yang terjadi jika bilangan yang dikurangkan bernilai negatif?",
                                    "What happens when the number being subtracted is negative?"),
                    bilingual(f"Mengurangi {B} sama dengan menambahkan {number(-b)} pada {A}.",
                              f"Subtracting {B} adds {number(-b)} to {A}."), binop("ADD", a, -b))
        # Split the right operand at a meaningful place, preserving the sign of the remainder.
        size = 10**max(0, len(str(abs(int(b))))-1)
        high = int(b/size)*size
        rest = b-high
        if high and rest:
            sub = a + high if op == "ADD" else a-high
            return ("DE", bilingual(f"Pisahkan {B} menjadi {number(high)} dan {number(rest)}.",
                                    f"Split {B} into {number(high)} and {number(rest)}."),
                    bilingual(f"Kerjakan {A} {sign} ({number(high)}) terlebih dahulu. Gunakan {number(sub)} untuk menyelesaikan bagian sisanya.",
                              f"Work out {A} {sign} ({number(high)}) first. Use {number(sub)} to finish the remaining part."),
                    binop(op, sub, rest))
        note = (f"Pada garis bilangan, mulai dari {A} lalu bergerak {number(abs(b))} satuan ke "
                + ("kanan." if ((b>=0)==(op=="ADD")) else "kiri."))
        en = f"On the number line, start at {A} and move {number(abs(b))} units " + ("right." if ((b>=0)==(op=="ADD")) else "left.")
        return ("NB" if grade<=6 else "SG", bilingual(note, en),
                bilingual(f"{note} Titik akhirnya {R}.", f"{en} The endpoint is {R}."), None)

    if op == "DIV" and ("/" in str(lb) or b.denominator > 1):
        inverse = 1/b
        return ("FR", bilingual(f"Tulis kebalikan dari {B}, lalu gunakan perkalian.",
                                f"Write the reciprocal of {B}, then multiply."),
                bilingual(f"Kebalikan dari {B} adalah {number(inverse)}. Perkalian {A} × ({number(inverse)}) memberi hasil bagi yang sama.",
                          f"The reciprocal of {B} is {number(inverse)}. Multiplying {A} by {number(inverse)} gives the same quotient."),
                binop("MUL", a, inverse))
    if op == "DIV":
        if abs(b)==2:
            return ("HL", bilingual(f"Bagi {A} menjadi dua bagian sama besar.",f"Split {A} into two equal parts."),
                    bilingual(f"Setengah dari {A} adalah {number(a/2)}." + (" Pembagi negatif membalikkan tanda hasil." if b<0 else ""),
                              f"Half of {A} is {number(a/2)}." + (" A negative divisor reverses the sign." if b<0 else "")),None)
        anchor = nearest_anchor(b)
        if grade >= 3 and anchor is not None and abs(anchor) >= 10 and result.denominator == 1 and a > 0 and b > 0 and result >= 10:
            # MATH-002: split the dividend into two multiples of the divisor (no remainder below zero).
            tens = int(result) // 10 * 10
            rest = int(result) - tens
            chunk = tens * b
            if rest:
                return ("DE", bilingual(f"Cari kelipatan {B} yang mudah dan tidak melebihi {A}, misalnya {tens} × {B}.",
                                        f"Find an easy multiple of {B} that does not exceed {A}, such as {tens} × {B}."),
                        bilingual(f"Pisahkan {A} menjadi {number(chunk)} + {number(a-chunk)}; keduanya kelipatan {B}. Bagi setiap bagian, lalu jumlahkan hasilnya.",
                                  f"Split {A} into {number(chunk)} + {number(a-chunk)}; both are multiples of {B}. Divide each part, then add the results."),
                        [(binop("ADD", binop("DIV", chunk, b), binop("DIV", a-chunk, b)),
                          bilingual(f"{A} = {number(chunk)} + {number(a-chunk)}.", f"{A} = {number(chunk)} + {number(a-chunk)}.")),
                         (binop("ADD", tens, rest),
                          bilingual(f"{number(chunk)} ÷ {B} = {tens} dan {number(a-chunk)} ÷ {B} = {rest}.",
                                    f"{number(chunk)} ÷ {B} = {tens} and {number(a-chunk)} ÷ {B} = {rest}."))])
            return ("PO", bilingual(f"Bagi {A} dengan 10 dahulu. Berapa {number(a/10)} ÷ {B}?",
                                    f"Divide {A} by 10 first. What is {number(a/10)} ÷ {B}?"),
                    bilingual(f"{A} adalah {number(a/10)} puluhan. Bagi {number(a/10)} dengan {B}, lalu kalikan hasilnya dengan 10.",
                              f"{A} is {number(a/10)} tens. Divide {number(a/10)} by {B}, then multiply the result by 10."),
                    [(binop("MUL", binop("DIV", a/10, b), 10), bilingual(f"{A} ÷ {B} = ({number(a/10)} ÷ {B}) × 10.", f"{A} ÷ {B} = ({number(a/10)} ÷ {B}) × 10.")),
                     (binop("MUL", tens//10, 10), bilingual(f"{number(a/10)} ÷ {B} = {tens//10}.", f"{number(a/10)} ÷ {B} = {tens//10}."))])
        if grade >= 3 and anchor is not None and abs(anchor) >= 10 and result.denominator == 1:
            estimate = round(a / anchor)
            remainder = a - estimate * b
            corrected = binop("ADD", estimate, binop("DIV", remainder, b))
            return ("CO", bilingual(f"Perkirakan hasil bagi dengan patokan {number(anchor)}. Periksa perkiraan dengan pembagi asli.",
                                    f"Estimate the quotient using {number(anchor)}. Check the estimate against the original divisor."),
                    bilingual(f"Perkiraan {estimate} memberi {estimate} × ({B}) = {number(estimate*b)}. Sisanya {number(remainder)}. Bagi sisa itu dengan {B} untuk mengoreksi perkiraan.",
                              f"The estimate {estimate} gives {estimate} × ({B}) = {number(estimate*b)}. The remainder is {number(remainder)}. Divide it by {B} to correct the estimate."),
                    corrected if grade>=7 or (remainder>=0 and (remainder/b).denominator==1) else None)
        if b>0 and b.denominator==1:
            for f in (10, 5, 2, 3):
                if 1 < f < b and b%f==0 and (grade>=5 or (a/f).denominator==1):
                    g=b/f
                    return ("HD", bilingual(f"Pecah pembagi {B} menjadi {f} × {number(g)}.",
                                            f"Split the divisor {B} into {f} × {number(g)}."),
                            bilingual(f"Bagi {A} dengan {f} untuk memperoleh {number(a/f)}. Kemudian bagi dengan {number(g)}.",
                                      f"Divide {A} by {f} to get {number(a/f)}. Then divide by {number(g)}."),binop("DIV",a/f,g))
        return inverse_hint(a,b,result)
    if a.denominator>1 or b.denominator>1:
        x,y=a.numerator,b.numerator
        d,e=a.denominator,b.denominator
        left_cancel,right_cancel=gcd(abs(x),e),gcd(abs(y),d)
        if max(left_cancel,right_cancel)>1:
            nx,ne=x//left_cancel,e//left_cancel
            ny,nd=y//right_cancel,d//right_cancel
            return ("FR", bilingual(f"Tulis {A} dan {B} sebagai pecahan. Cari faktor yang dapat dicoret silang.",
                                    f"Write {A} and {B} as fractions. Look for a common factor across the product."),
                    bilingual(f"Mulai dengan ({x}/{d}) × ({y}/{e}). Setelah mencoret faktor persekutuan, hitung ({nx} × {ny})/({nd} × {ne}).",
                              f"Start with ({x}/{d}) × ({y}/{e}). After cross-cancelling common factors, compute ({nx} × {ny})/({nd} × {ne})."),
                    binop("DIV",binop("MUL",nx,ny),nd*ne))
        return ("EQ", bilingual(f"Nyatakan faktor sebagai {x}/{d} dan {y}/{e}.",
                                f"Express the factors as {x}/{d} and {y}/{e}."),
                bilingual(f"Kalikan pembilang {x} × {y} dan penyebut {d} × {e}, lalu sederhanakan.",
                          f"Multiply the numerators {x} × {y} and denominators {d} × {e}, then simplify."),
                binop("DIV",x*y,d*e))
    if grade >= 3 and 5 in (a,b) and min(a,b) > 0:
        other = b if a == 5 else a
        return ("HL", bilingual(f"Lima adalah setengah dari sepuluh. Berapa sepuluh kelompok {number(other)}?",
                                f"Five is half of ten. How much are ten groups of {number(other)}?"),
                bilingual(f"Sepuluh kelompok {number(other)} berjumlah {number(other*10)}. Ambil setengahnya untuk mendapat lima kelompok.",
                          f"Ten groups of {number(other)} make {number(other*10)}. Take half to find five groups."),
                binop("DIV",other*10,2))
    for v,w in ((b,a),(a,b)):
        if v in (25,50,125,250) and w%({25:4,50:2,125:8,250:4}[v])==0:
            factor={25:4,50:2,125:8,250:4}[v]
            return ("HD", bilingual(f"Bisakah {number(w)} dibagi {factor} agar faktor {number(v)} lebih mudah dikalikan?",
                                    f"Can you divide {number(w)} by {factor} to make the factor {number(v)} easier to use?"),
                    bilingual(f"Bagi satu faktor dengan {factor} dan kalikan faktor lainnya dengan {factor}. Hasil kali tetap sama.",
                              f"Divide one factor by {factor} and multiply the other by {factor}. The product stays the same."),
                    binop("MUL",w/factor,v*factor))
        if v in (10,100,1000):
            places=len(str(int(v)))-1
            return ("PO", bilingual(f"Pikirkan nilai setiap digit jika dikalikan {number(v)}.",
                                    f"Think about each digit's place value when multiplied by {number(v)}."),
                    bilingual(f"Setiap digit pada {number(w)} bergerak {places} tempat ke nilai tempat yang lebih tinggi. Hasilnya {R}.",
                              f"Each digit in {number(w)} moves {places} decimal position(s) to the left on a place-value chart, giving {R}."), None)
    if b in (0,1,2) or a in (0,1,2):
        v,w=(b,a) if b in (0,1,2) else (a,b)
        if v==2:
            return ("DB", bilingual(f"Gunakan dua salinan {number(w)}.",f"Use two copies of {number(w)}."),
                    bilingual(f"Penggandaan {number(w)} sama dengan {number(w)} + ({number(w)}).",
                              f"Doubling {number(w)} means adding {number(w)} to itself."),binop("ADD",w,w))
        return ("NB",bilingual(f"Gunakan sifat perkalian dengan {number(v)}.",f"Use the multiplication rule for {number(v)}."),
                bilingual("Faktor nol menghasilkan nol." if v==0 else "Faktor satu mempertahankan nilai faktor yang lain.",
                          "A zero factor gives zero." if v==0 else "A factor of one leaves the other factor unchanged."),None)
    # Use the near-base factor first. For early positive integers, subtraction of excess stays nonnegative.
    v,w=(b,a)
    if nearest_anchor(v) is None and nearest_anchor(w) is not None: v,w=w,v
    base=nearest_anchor(v)
    if base is None:
        base=(1 if v>0 else -1)*(5 if abs(v)>=6 and abs(v)<10 else 10**max(0,len(str(abs(int(v))))-1))
    offset=v-base
    first=w*base
    correction=w*offset
    hint=bilingual(f"Gunakan {number(v)} = {number(base)} {'+' if offset>=0 else '−'} {number(abs(offset))}.",
                   f"Use {number(v)} = {number(base)} {'+' if offset>=0 else '−'} {number(abs(offset))}.")
    if v>=0 and w>=0 and base>0:
        # MATH-002: count whole groups that are added or taken away; magnitudes only.
        k=abs(offset); K=number(k); W=number(w); C=number(abs(correction))
        if offset<0:
            text=bilingual(f"{number(base)} kelompok {W} adalah {number(first)}. {number(v)} kelompok berarti {K} kelompok lebih sedikit, jadi kurangi {K} × {W} = {C}.",
                           f"{number(base)} groups of {W} make {number(first)}. {number(v)} groups is {K} group{'s' if k!=1 else ''} fewer, so take away {K} × {W} = {C}.")
        else:
            text=bilingual(f"{number(base)} kelompok {W} adalah {number(first)}. Tambahkan {K} kelompok lagi, yaitu {K} × {W} = {C}.",
                           f"{number(base)} groups of {W} make {number(first)}. Add {K} more group{'s' if k!=1 else ''}, that is {K} × {W} = {C}.")
        steps=[(binop("ADD" if correction>=0 else "SUB",first,abs(correction)),
                bilingual(f"{number(base)} × {W} = {number(first)} dan {K} × {W} = {C}.",f"{number(base)} × {W} = {number(first)} and {K} × {W} = {C}."))]
        return ("DS",hint,text,steps)
    return ("DS", hint,
            bilingual(f"Kalikan {number(w)} dengan {number(base)}. Lalu perhitungkan bagian {number(offset)} × ({number(w)}).",
                      f"Multiply {number(w)} by {number(base)}. Then account for {number(offset)} × ({number(w)})."),
            binop("ADD" if correction>=0 else "SUB",first,abs(correction)))


def factor_once(t):
    """Return one equivalent regrouping and the exact local equality that explains it."""
    if not isinstance(t,tuple): return None
    op,left,right=t
    if op in ("ADD","SUB"):
        left_factors=list(left[1:]) if isinstance(left,tuple) and left[0]=="MUL" else [left]
        right_factors=list(right[1:]) if isinstance(right,tuple) and right[0]=="MUL" else [right]
        if len(left_factors)+len(right_factors)>2:
            for i,common in enumerate(left_factors):
                if common not in right_factors or value(common) in (0,1,-1): continue
                j=right_factors.index(common)
                a=(left_factors[:i]+left_factors[i+1:] or ["1"])[0]
                b=(right_factors[:j]+right_factors[j+1:] or ["1"])[0]
                new=("MUL",(op,a,b),common)
                return new,common,t,new
    for pos in (1,2):
        nested=factor_once(t[pos])
        if nested:
            replacement,common,before,after=nested
            out=list(t);out[pos]=replacement
            return tuple(out),common,before,after
    return None


def ease_division(t):
    """Find a product over an integer divisor that cancels against one factor exactly."""
    if not isinstance(t,tuple):
        return None
    op, left, divisor = t
    if op == "DIV" and isinstance(left,tuple) and left[0] == "MUL" and not isinstance(divisor,tuple):
        d = value(divisor)
        if d.denominator == 1 and d > 1:
            for side in (2,1):
                factor = left[side]
                if isinstance(factor,tuple):
                    continue
                f = value(factor)
                if f > 0 and f.denominator == 1 and f % d == 0:
                    rest = left[3-side]
                    reduced = str(f/d)
                    return (("MUL", rest, reduced), number(f), number(d), number(f/d))
    for side in (1,2):
        found = ease_division(t[side])
        if found:
            replacement, f, d, reduced = found
            rebuilt = list(t)
            rebuilt[side] = replacement
            return tuple(rebuilt), f, d, reduced
    return None


def reduce_inner(tree):
    """Compute one innermost operation; retain the full expression in the step."""
    op, left, right = tree
    if isinstance(left,tuple):
        replacement, inner = reduce_inner(left)
        return (op,replacement,right), inner
    if isinstance(right,tuple):
        replacement, inner = reduce_inner(right)
        return (op,left,replacement), inner
    return str(value(tree)), tree


def teach(tree, grade, level, operation):
    def has_decimal(t):
        return has_decimal(t[1]) or has_decimal(t[2]) if isinstance(t,tuple) else "." in str(t)
    DECIMAL_STYLE.set(has_decimal(tree))
    result=value(tree)
    steps=[]
    def step(t,message):
        if value(t)!=result: raise ArithmeticError((tree,t))
        steps.append({"kind":"equivalent_expression","expression_ast":ast(t),"text":message})
    if not isinstance(tree[1],tuple) and not isinstance(tree[2],tuple):
        tag,hint,explanation,work=basic(tree,grade)
        if isinstance(work,list):
            for t,message in work: step(t,message)
        elif work is not None: step(work,explanation)
        tags=[tag]
    else:
        # Use factorisation and exact cancellation before computing large products.
        # Each step stores one full, equivalent AST for independent verification.
        source = tree
        factoring = factor_once(source) if grade >= 6 else None
        if factoring:
            source,common,before,after = factoring
            term = expression(common)
            hint = bilingual(f"Bilangan mana yang ada di kedua suku dalam {expression(before)}?",
                             f"Which number appears in both terms of {expression(before)}?")
            explanation = bilingual(f"Gabungkan kelompok yang sama besar. Setiap kelompok berisi {term}.",
                                    f"Combine the equal-sized groups. Each group contains {term}.")
            step(source,bilingual(f"Tulis kedua suku sebagai satu hasil kali dengan faktor {term}.",
                                  f"Write the two terms as one product with the common factor {term}."))
            tags = ["DS","OO"]
        else:
            tags = ["OO"]
        while isinstance(source,tuple):
            cancellation = ease_division(source) if grade >= 4 else None
            if cancellation:
                source, f, d, reduced = cancellation
                first = len(tags) == 1
                if first:
                    hint = bilingual(f"Sebelum mengalikan, lihat faktor {f}. Bisakah kamu membaginya dengan {d}?",
                                     f"Before multiplying, look at the factor {f}. Can you divide it by {d}?")
                    explanation = bilingual("Bagi salah satu faktor terlebih dahulu agar perkaliannya lebih kecil.",
                                            "Divide one factor first to make the multiplication smaller.")
                tags = list(dict.fromkeys([*tags,"HD"]))
                step(source,bilingual(f"Bagi faktor {f} dengan {d} untuk mendapat {reduced}.",
                                      f"Divide the factor {f} by {d} to get {reduced}."))
                continue
            source, inner = reduce_inner(source)
            term = expression(inner)
            if len(tags) == 1:
                tag, first_hint, reason, _ = basic(inner,grade)
                hint = bilingual(f"Mulai dari {term}. " + first_hint["id"],
                                 f"Start with {term}. " + first_hint["en"])
                explanation = reason
                tags.append(tag)
            step(source,bilingual(f"{term} = {number(value(inner))}.",
                                  f"{term} = {number(value(inner))}."))
    if not steps or steps[-1]["expression_ast"]["kind"] != "rational":
        step(str(result),bilingual(f"Hasil akhirnya {number(result)}.",f"The final value is {number(result)}."))
    return {"answer":rational(result),"expression_ast":ast(tree,True),"neutral_expression":expression(tree),
            "strategy_tags":tags,"hint":hint,"explanation":explanation,"solution_steps":steps}
