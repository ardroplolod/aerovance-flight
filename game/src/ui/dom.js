// A tiny element builder for the interface: h('div', { class, onclick }, children).
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** A labelled 0..100 stat bar. */
export function statBar(label, value, compare = null, suffix = '') {
  return h('div', { class: 'stat' }, [
    h('span', { class: 'stat-label' }, label),
    h('div', { class: 'stat-track' }, [
      h('i', { style: { width: `${Math.max(2, Math.min(100, value))}%` } }),
      compare != null ? h('u', { style: { left: `${Math.max(0, Math.min(100, compare))}%` } }) : null,
    ]),
    h('b', {}, `${Math.round(value)}${suffix}`),
  ]);
}
