const blessed = require('blessed');

function initScreen() {
  const screen = blessed.screen({
    smartCSR: true, title: 'Dexlyn Arb Bot v2.5.1',
    fullUnicode: true, forceUnicode: true,
  });
  screen.program.hideCursor();

  const headerBox = blessed.box({
    top: 0, left: 0, width: '55%', height: 7,
    tags: true, wrap: false,
  });

  const pricesBox = blessed.box({
    top: 7, left: 0, width: '55%', bottom: 2,
    tags: true, wrap: false,
    scrollable: true, alwaysScroll: true,
    scrollbar: { ch: '│', style: { fg: 'grey' } },
    mouse: true, keys: true,
    border: { type: 'line' },
    label: ' {bold}{grey-fg}MERCADO{/}{/} ',
    style: { border: { fg: 'grey' } },
  });

  const arbBox = blessed.box({
    top: 0, left: '55%', width: '45%', height: '60%',
    tags: true, wrap: false,
    scrollable: true, alwaysScroll: true,
    scrollbar: { ch: '│', style: { fg: 'cyan' } },
    mouse: true, keys: true,
    border: { type: 'line' },
    label: ' {bold}{cyan-fg}ARB DETECTOR{/}{/} ',
    style: { border: { fg: 'cyan' } },
  });

  const logBox = blessed.box({
    top: '60%', left: '55%', width: '45%', bottom: 2,
    tags: true, wrap: false,
    scrollable: true, alwaysScroll: true,
    scrollbar: { ch: '│', style: { fg: 'blue' } },
    mouse: true, keys: true,
    border: { type: 'line' },
    label: ' {bold}{blue-fg}LOG DE ARBS{/}{/} ',
    style: { border: { fg: 'blue' } },
  });

  const footerBox = blessed.box({
    bottom: 0, left: 0, width: '100%', height: 2,
    tags: true, wrap: false,
  });

  screen.append(headerBox);
  screen.append(pricesBox);
  screen.append(arbBox);
  screen.append(logBox);
  screen.append(footerBox);

  const scrollBoxes = [pricesBox, arbBox, logBox];
  let focusIdx = 1;
  let scrollPaused = false;

  function setFocus(idx) {
    focusIdx = idx;
    pricesBox.style.border.fg = idx === 0 ? 'white' : 'grey';
    arbBox.style.border.fg    = idx === 1 ? 'cyan'  : 'grey';
    logBox.style.border.fg    = idx === 2 ? 'blue'  : 'grey';
    scrollBoxes[idx].focus();
    screen.render();
  }
  setFocus(1);

  screen.key(['tab'], () => setFocus((focusIdx + 1) % 3));
  screen.key(['space'], () => {
    scrollPaused = !scrollPaused;
    const lbl = scrollPaused
      ? ' {bold}{cyan-fg}ARB DETECTOR{/}{/} {yellow-fg}[PAUSADO — SPACE retoma]{/} '
      : ' {bold}{cyan-fg}ARB DETECTOR{/}{/} ';
    arbBox.setLabel(lbl);
    screen.render();
  });

  screen.key(['up'],       () => { if (focusIdx>0) scrollPaused=true; scrollBoxes[focusIdx].scroll(-1);  screen.render(); });
  screen.key(['down'],     () => { if (focusIdx>0) scrollPaused=true; scrollBoxes[focusIdx].scroll(1);   screen.render(); });
  screen.key(['pageup'],   () => { if (focusIdx>0) scrollPaused=true; scrollBoxes[focusIdx].scroll(-10); screen.render(); });
  screen.key(['pagedown'], () => { if (focusIdx>0) scrollPaused=true; scrollBoxes[focusIdx].scroll(10);  screen.render(); });
  screen.key(['home'],     () => { scrollBoxes[focusIdx].scrollTo(0); screen.render(); });
  screen.key(['end'],      () => { scrollBoxes[focusIdx].scrollTo(scrollBoxes[focusIdx].getScrollHeight()); screen.render(); });

  pricesBox.on('wheeldown', () => { pricesBox.scroll(3);  screen.render(); });
  pricesBox.on('wheelup',   () => { pricesBox.scroll(-3); screen.render(); });
  arbBox.on('wheeldown',    () => { scrollPaused = true; arbBox.scroll(3);  screen.render(); });
  arbBox.on('wheelup',      () => { scrollPaused = true; arbBox.scroll(-3); screen.render(); });
  logBox.on('wheeldown',    () => { logBox.scroll(3);  screen.render(); });
  logBox.on('wheelup',      () => { logBox.scroll(-3); screen.render(); });

  pricesBox.on('click', () => setFocus(0));
  arbBox.on('click',    () => setFocus(1));
  logBox.on('click',    () => setFocus(2));

  screen.key(['C-c', 'q'], () => { screen.program.showCursor(); screen.destroy(); process.exit(0); });

  return { screen, headerBox, pricesBox, arbBox, logBox, footerBox, scrollPaused: () => scrollPaused, setScrollPaused: (v) => { scrollPaused = v; } };
}

module.exports = { initScreen };