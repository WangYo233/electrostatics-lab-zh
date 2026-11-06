'use strict';
// 轻量 LaTeX → MathML 转换，覆盖本实验室理论公式所用的子集，无需联网加载公式库
// 参数规则与 TeX 相同：\frac12、\sqrt3、r^23 中的单记号参数只取一个字符（\frac12 = 1/2）
(function (EL) {
  const SYM = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', theta: 'θ', vartheta: 'ϑ', lambda: 'λ', mu: 'μ', nu: 'ν',
    xi: 'ξ', eta: 'η', zeta: 'ζ', kappa: 'κ', chi: 'χ', psi: 'ψ', Psi: 'Ψ', Gamma: 'Γ', Lambda: 'Λ', Theta: 'Θ',
    pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'ϕ', varphi: 'φ', omega: 'ω', Delta: 'Δ', Phi: 'Φ', Omega: 'Ω', Sigma: 'Σ',
    nabla: '∇', partial: '∂', infty: '∞', ell: 'ℓ', hbar: 'ℏ', cdot: '⋅', times: '×', div: '÷', pm: '±', mp: '∓', le: '≤', leq: '≤', ge: '≥', geq: '≥',
    ne: '≠', neq: '≠', approx: '≈', simeq: '≃', sim: '∼', equiv: '≡', propto: '∝', to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒',
    Leftrightarrow: '⇔', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩', forall: '∀', exists: '∃',
    sum: '∑', prod: '∏', oint: '∮', int: '∫', iint: '∬', prime: '′', ldots: '…', cdots: '⋯', dots: '…',
    lVert: '‖', rVert: '‖', Vert: '‖', '|': '‖', vert: '|', lvert: '|', rvert: '|', langle: '⟨', rangle: '⟩', '{': '{', '}': '}', lbrace: '{', rbrace: '}',
    perp: '⊥', parallel: '∥', angle: '∠', circ: '∘', degree: '°', ast: '∗', star: '⋆', '%': '%', '#': '#', '&': '&', _: '_'
  };
  // 间距（em）；\! 为负间距，这里直接忽略
  const SPACE = { quad: 1, qquad: 2, ',': 0.1667, ':': 0.2222, '>': 0.2222, ';': 0.2778, ' ': 0.25, enspace: 0.5, thinspace: 0.1667, '!': 0 };
  const FN = { sin: 1, cos: 1, tan: 1, cot: 1, sec: 1, csc: 1, ln: 1, log: 1, exp: 1, sgn: 1, min: 1, max: 1, lim: 1, det: 1, arg: 1, arccos: 1, arcsin: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1 };
  const LIMITS = { sum: 1, prod: 1, lim: 1, max: 1, min: 1 };   // 显示公式中上下限放在正上、正下方
  const LARGE = { sum: 1, prod: 1, int: 1, oint: 1, iint: 1 };
  const DELIM = { '(': 1, ')': 1, '[': 1, ']': 1, '|': 1, '/': 1 };
  // 排版约定（AIP Style Manual；ISO 80000-2）：矢量用粗斜体；变量用斜体；
  // 微分 d、常数 π、算符 Δ ∇ 用正体；说明性下标（in、field 等）用正体；减号用 “−”
  const UPRIGHT = { pi: 1, Delta: 1, nabla: 1 };
  const boldIt = ch => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D468 + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D482 + c - 97);
    if (c >= 0x391 && c <= 0x3A9 && c !== 0x3A2) return String.fromCodePoint(0x1D71C + c - 0x391);
    if (c >= 0x3B1 && c <= 0x3C9) return String.fromCodePoint(0x1D736 + c - 0x3B1);
    if (c === 0x3D5) return '𝝓'; if (c === 0x3C6) return '𝝋'; if (c === 0x3F5) return '𝝐';
    if (c >= 48 && c <= 57) return String.fromCodePoint(0x1D7CE + c - 48);
    return null;
  };
  const SUBS = '₀₁₂₃₄₅₆₇₈₉', SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const fromScript = (s, set) => s.replace(/./gu, ch => String(set.indexOf(ch)));
  const SUP_DIGIT = { '²': '2', '³': '3', '¹': '1' };

  // 记号：命令 \xxx、数字串、单个字符；Unicode 上、下标数字连成一个记号（标为 _₁、^²）
  function tokenize(s) {
    const t = [];
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (c === '\\') {
        const m = s.slice(i + 1).match(/^([a-zA-Z]+|[\s\S])/);
        if (!m) { i++; continue; }
        t.push('\\' + (/^\s$/.test(m[1]) ? ' ' : m[1])); i += 1 + m[1].length;
      } else if (/\s/.test(c)) i++;
      else if (/[0-9]/.test(c) || c === '.' && /[0-9]/.test(s[i + 1] || '')) { const m = s.slice(i).match(/^[0-9]*\.?[0-9]+/); t.push(m[0]); i += m[0].length; }
      else if (SUBS.includes(c)) { let j = i; while (j < s.length && SUBS.includes(s[j])) j++; t.push('_' + fromScript(s.slice(i, j), SUBS)); i = j; }
      else if (SUPS.includes(c) || SUP_DIGIT[c]) { let j = i; while (j < s.length && (SUPS.includes(s[j]) || SUP_DIGIT[s[j]])) j++; t.push('^' + s.slice(i, j).replace(/./gu, ch => SUP_DIGIT[ch] || String(SUPS.indexOf(ch)))); i = j; }
      else { const cp = String.fromCodePoint(s.codePointAt(i)); t.push(cp); i += cp.length; }
    }
    return t;
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const mrow = a => a.length === 1 ? a[0] : '<mrow>' + a.join('') + '</mrow>';
  const EMPTY = '<mrow></mrow>';
  const fence = s => '<mo fence="true" stretchy="true">' + esc(s) + '</mo>';

  function Parser(src, display) { this.t = tokenize(src); this.i = 0; this.display = display !== false; }
  Parser.prototype.peek = function () { return this.t[this.i]; };
  Parser.prototype.next = function () { return this.t[this.i++]; };
  Parser.prototype.done = function () { return this.i >= this.t.length; };

  // 解析一串元素，直到遇到停止符（停止符本身不读入）
  Parser.prototype.list = function (stop) {
    const out = [];
    while (!this.done() && !(stop && stop.includes(this.peek()))) {
      const start = this.i;
      const base = this.atom();
      if (base == null) continue;
      out.push(this.scripts(base, start));
    }
    return out;
  };
  // 上、下标与撇号：a_1^2、a^2_1、A'、A'_1、T₁
  Parser.prototype.scripts = function (a, start) {
    let sub = null, sup = null, primes = '';
    for (;;) {
      const k = this.peek();
      if (k === "'" || k === '′') { this.next(); primes += '′'; continue; }
      if (k === '_' || k === '^') { this.next(); const g = this.arg(); if (k === '_') sub = g; else sup = g; continue; }
      if (k && k.length > 1 && (k[0] === '_' || k[0] === '^') && /^[_^][0-9]+$/.test(k)) {
        this.next(); const g = '<mn>' + k.slice(1) + '</mn>'; if (k[0] === '_') sub = g; else sup = g; continue;
      }
      break;
    }
    if (primes) sup = sup ? '<mrow><mo>' + primes + '</mo>' + sup + '</mrow>' : '<mo>' + primes + '</mo>';
    if (!sub && !sup) return a;
    const op = this.t[start];
    const lim = op && op[0] === '\\' && LIMITS[op.slice(1)] && this.display;
    if (lim) {
      if (sub && sup) return '<munderover>' + a + sub + sup + '</munderover>';
      return sub ? '<munder>' + a + sub + '</munder>' : '<mover>' + a + sup + '</mover>';
    }
    if (sub && sup) return '<msubsup>' + a + sub + sup + '</msubsup>';
    return sub ? '<msub>' + a + sub + '</msub>' : '<msup>' + a + sup + '</msup>';
  };

  // 命令的参数：{…} 或单个记号；多位数字只取第一位（与 TeX 一致：\frac12 = 1/2）
  Parser.prototype.arg = function () {
    const k = this.peek();
    if (k == null) return EMPTY;
    if (k === '{') { this.next(); const r = this.list(['}']); if (this.peek() === '}') this.next(); return r.length ? mrow(r) : EMPTY; }
    if (/^[0-9.]{2,}$/.test(k)) { this.t[this.i] = k.slice(1); return '<mn>' + k[0] + '</mn>'; }
    if (k === '}' || k === '&' || k === '\\\\' || k === '\\end' || k === '\\right') return EMPTY;
    const start = this.i, a = this.atom();
    return a == null ? EMPTY : a;
  };
  // 文字参数（\text、\mathrm、\begin 的环境名）
  Parser.prototype.text = function () {
    let s = '';
    if (this.peek() === '{') {
      this.next();
      let depth = 1;
      while (!this.done()) {
        const k = this.next();
        if (k === '{') depth++;
        else if (k === '}' && --depth === 0) break;
        if (k[0] === '\\' && k.length > 1) s += SYM[k.slice(1)] != null ? SYM[k.slice(1)] : SPACE[k.slice(1)] ? ' ' : k.slice(1);
        else if (/^[_^][0-9]+$/.test(k) && k.length > 1) s += k[0] === '_' ? k.slice(1).replace(/./g, d => SUBS[d]) : k.slice(1).replace(/./g, d => SUPS[d]);
        else s += k;
      }
    } else s = this.next() || '';
    return s;
  };

  Parser.prototype.atom = function () {
    const k = this.next();
    if (k == null) return null;
    if (k === '{') { const r = this.list(['}']); if (this.peek() === '}') this.next(); return r.length ? mrow(r) : EMPTY; }
    if (k === '}') return null;
    if (k === '&' || k === '\\\\') return null;
    if (k[0] === '\\' && k.length > 1) return this.command(k.slice(1));
    if (/^[_^][0-9]+$/.test(k) && k.length > 1) return null;          // 孤立的 Unicode 上下标（前面没有底数）
    if (k === '_' || k === '^') { this.arg(); return null; }           // 孤立的 _、^
    if (/^[0-9.]+$/.test(k)) return '<mn>' + k + '</mn>';
    if (/^[a-zA-Z]$/.test(k)) return '<mi>' + k + '</mi>';
    if (DELIM[k]) return '<mo stretchy="false"' + (k === '/' ? ' lspace="0" rspace="0"' : '') + '>' + k + '</mo>';
    if (k === '-' || k === '−') return '<mo>−</mo>';
    if (k === '*') return '<mo>∗</mo>';                               // 与 TeX 相同：* 是星号（V_* 等），乘号写 \times
    if (k === '~') return '<mspace width="0.25em"/>';
    if (/^[α-ωΑ-Ωϵϑϕ]$/.test(k)) return '<mi>' + k + '</mi>';
    if (/[　-鿿＀-￯]/.test(k)) {                      // 公式中直接写的中文按文字排
      let s = k; while (this.peek() && /[　-鿿＀-￯]/.test(this.peek())) s += this.next();
      return '<mtext>' + esc(s) + '</mtext>';
    }
    return '<mo>' + esc(k) + '</mo>';
  };
  // 矢量记号：单个字母（含希腊字母、数字 0）排成粗斜体；多字母（如 PC）用上方箭头
  Parser.prototype.boldNext = function () {
    let k = this.peek(), grouped = false;
    if (k === '{' && this.t[this.i + 2] === '}') { grouped = true; k = this.t[this.i + 1]; }
    let ch = null;
    if (k && /^[a-zA-Z0]$/.test(k)) ch = k;
    else if (k && /^[α-ωΑ-Ωϵϕ]$/.test(k)) ch = k;
    else if (k && k[0] === '\\' && SYM[k.slice(1)] && /^[α-ωΑ-Ωϵϕ]$/.test(SYM[k.slice(1)])) ch = SYM[k.slice(1)];
    const b = ch && boldIt(ch);
    if (!b) return null;
    this.i += grouped ? 3 : 1;
    return '<mi mathvariant="normal">' + b + '</mi>';
  };
  // 定界符记号 → 字符
  Parser.prototype.delim = function () {
    const d = this.next();
    if (d == null || d === '.') return '';
    if (d[0] === '\\' && d.length > 1) return SYM[d.slice(1)] != null ? SYM[d.slice(1)] : d.slice(1);
    return d;
  };

  Parser.prototype.command = function (c) {
    switch (c) {
      case 'frac': case 'tfrac': case 'dfrac': case 'cfrac': {
        const f = '<mfrac>' + this.arg() + this.arg() + '</mfrac>';
        if (c === 'tfrac') return '<mstyle displaystyle="false">' + f + '</mstyle>';
        if (c === 'dfrac' || c === 'cfrac') return '<mstyle displaystyle="true" scriptlevel="0">' + f + '</mstyle>';
        return f;
      }
      case 'sqrt': {
        if (this.peek() === '[') {
          this.next();
          const idx = this.list([']']); if (this.peek() === ']') this.next();
          return '<mroot>' + this.arg() + (idx.length ? mrow(idx) : EMPTY) + '</mroot>';
        }
        return '<msqrt>' + this.arg() + '</msqrt>';
      }
      case 'vec': { const b = this.boldNext(); return b || '<mover accent="true">' + this.arg() + '<mo stretchy="true">→</mo></mover>'; }
      case 'overrightarrow': return '<mover accent="true">' + this.arg() + '<mo stretchy="true">→</mo></mover>';
      case 'hat': { const b = this.boldNext(); return '<mover accent="true">' + (b || this.arg()) + '<mo>^</mo></mover>'; }
      case 'bar': case 'overline': return '<mover accent="true">' + this.arg() + '<mo stretchy="true">¯</mo></mover>';
      case 'dot': return '<mover accent="true">' + this.arg() + '<mo>˙</mo></mover>';
      case 'tilde': return '<mover accent="true">' + this.arg() + '<mo>~</mo></mover>';
      case 'mathrm': case 'rm': case 'mathup': {
        // 正体：微分 d、说明性下标、单位
        if (c === 'rm' && this.peek() !== '{') {
          let s = '';
          while (this.peek() && /^[a-zA-Z0-9]+$/.test(this.peek())) s += this.next();
          return s ? '<mi mathvariant="normal">' + esc(s) + '</mi>' : null;
        }
        const s = this.text();
        return /^[0-9.]+$/.test(s) ? '<mn>' + s + '</mn>' : '<mi mathvariant="normal">' + esc(s) + '</mi>';
      }
      case 'diff': return '<mi mathvariant="normal">d</mi>';
      case 'text': case 'textrm': case 'mbox': case 'textup': return '<mtext>' + esc(this.text()) + '</mtext>';
      case 'operatorname': return '<mi>' + esc(this.text()) + '</mi><mo>⁡</mo>';
      case 'mathbf': case 'boldsymbol': case 'bm': { const b = this.boldNext(); return b || '<mstyle mathvariant="bold">' + this.arg() + '</mstyle>'; }
      case 'mathit': return '<mi>' + esc(this.text()) + '</mi>';
      case 'displaystyle': return null;
      case 'left': {
        // \left( … \right)：括号随内容伸缩；上、下标作用在整个括号组上
        const open = this.delim();
        const inner = this.list(['\\right']);
        let close = '';
        if (this.peek() === '\\right') { this.next(); close = this.delim(); }
        return '<mrow>' + (open ? fence(open) : '') + mrow(inner.length ? inner : [EMPTY]) + (close ? fence(close) : '') + '</mrow>';
      }
      case 'right': { const d = this.delim(); return d ? fence(d) : null; }   // 没有配对的 \right
      case 'big': case 'Big': case 'bigg': case 'Bigg': case 'bigl': case 'bigr': case 'Bigl': case 'Bigr': case 'biggl': case 'biggr': {
        const d = this.delim(), sz = /^bigg/i.test(c) ? (c[0] === 'B' ? 3 : 2.4) : c[0] === 'B' ? 1.8 : 1.2;
        return d ? '<mo fence="true" stretchy="true" symmetric="true" minsize="' + sz + 'em" maxsize="' + sz + 'em">' + esc(d) + '</mo>' : null;
      }
      case 'begin': {
        const env = this.text();
        const rows = [[[]]];
        while (!this.done()) {
          const k = this.peek();
          if (k === '\\end') { this.next(); this.text(); break; }
          if (k === '&') { this.next(); rows[rows.length - 1].push([]); continue; }
          if (k === '\\\\') { this.next(); rows.push([[]]); continue; }
          const r = this.list(['&', '\\\\', '\\end']);
          rows[rows.length - 1][rows[rows.length - 1].length - 1].push(...r);
        }
        if (rows.length > 1 && rows[rows.length - 1].every(x => !x.length)) rows.pop();   // 末尾多余的 \\
        const left = env === 'cases' || env === 'aligned' || env === 'array';
        const td = (cell, j) => '<mtd' + (left ? ' columnalign="left" style="text-align:left;padding:0.1em ' + (j ? '0 ' : '1em ') + '0.1em ' + (j ? '1em' : '0') + '"' : '') + '>' + mrow(cell.length ? cell : [EMPTY]) + '</mtd>';
        const tbl = '<mtable' + (left ? ' columnalign="left"' : '') + '>' + rows.map(r => '<mtr>' + r.map(td).join('') + '</mtr>').join('') + '</mtable>';
        if (env === 'cases') return '<mrow><mo stretchy="true" fence="true">{</mo>' + tbl + '</mrow>';
        if (env === 'pmatrix') return '<mrow>' + fence('(') + tbl + fence(')') + '</mrow>';
        if (env === 'bmatrix') return '<mrow>' + fence('[') + tbl + fence(']') + '</mrow>';
        return tbl;
      }
      case 'end': this.text(); return null;
    }
    if (c in SPACE) return SPACE[c] ? '<mspace width="' + SPACE[c] + 'em"/>' : null;
    if (FN[c]) return '<mi>' + c + '</mi><mo>⁡</mo>';
    if (c in SYM) {
      const s = SYM[c];
      if (UPRIGHT[c]) return c === 'nabla' ? '<mo>∇</mo>' : '<mi mathvariant="normal">' + s + '</mi>';
      if (/^[α-ωΑ-Ωϵϑϕ]$/.test(s)) return '<mi>' + s + '</mi>';
      if (c === 'partial' || c === 'infty' || c === 'ell' || c === 'hbar') return '<mi>' + s + '</mi>';
      if (c === 'prime') return '<mo>′</mo>';
      if (/^[‖|{}]$/.test(s)) return '<mo stretchy="false">' + esc(s) + '</mo>';
      return '<mo' + (LARGE[c] ? ' largeop="' + this.display + '"' : '') + '>' + esc(s) + '</mo>';
    }
    // 未知命令：显示为错误，便于在测试中发现
    return '<merror><mtext>\\' + esc(c) + '</mtext></merror>';
  };

  // 长公式在顶层 \quad、\qquad 处拆成多行，避免出现横向滚动条（不拆分花括号、\left…\right 与 cases 内部）
  EL.texLines = function (src) {
    const out = [];
    let depth = 0, cur = '', i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\' && i + 1 < src.length && !/[a-zA-Z]/.test(src[i + 1])) { cur += c + src[i + 1]; i += 2; continue; }  // \{ \} \, \\ 等
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (src.startsWith('\\begin', i) || /^\\left(?![a-zA-Z])/.test(src.slice(i, i + 6))) depth += 100;
      if (src.startsWith('\\end', i) || /^\\right(?![a-zA-Z])/.test(src.slice(i, i + 7))) depth -= 100;
      const m = depth === 0 && src.slice(i).match(/^,?\s*\\q?quad(?![a-zA-Z])/);
      // \quad 后面紧跟括号的是适用条件，例如 \quad(z\ne0)，与前面的式子留在同一行
      if (m && !/^\s*\(/.test(src.slice(i + m[0].length))) { if (cur.trim()) out.push(cur.trim().replace(/,$/, '')); cur = ''; i += m[0].length; continue; }
      cur += c; i++;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.length ? out : [src];
  };
  EL.texBlock = src => EL.texLines(src).map(s => EL.tex(s)).join('');
  // 带编号的显示公式（编号右对齐，与期刊排版一致）
  EL.texEq = (src, n) => '<div class="eqn"><div class="eqn-m">' + EL.texBlock(src) + '</div>' + (n != null ? '<span class="eqn-n">(' + n + ')</span>' : '') + '</div>';

  EL.tex = function (src, display) {
    try {
      const p = new Parser(String(src), display);
      const body = [];
      while (!p.done()) {               // 顶层多余的 } 或 \right 不终止解析
        body.push(...p.list());
        if (!p.done()) p.next();
      }
      return '<math' + (display === false ? '' : ' display="block"') + '>' + mrow(body.length ? body : [EMPTY]) + '</math>';
    } catch (e) {
      return '<code>' + esc(src) + '</code>';
    }
  };
})(window.EL);
