    (() => {
      'use strict';
      const chips = Array.from(document.querySelectorAll('.chip'));
      const sections = Array.from(document.querySelectorAll('.gsection'));
      const input = document.getElementById('gsearch');
      const counter = document.getElementById('gcount');
      const empty = document.getElementById('gempty');
      if (!chips.length || !sections.length) return;
      let current = (location.hash || '').replace('#', '');
      if (!sections.some(s => s.dataset.cat === current)) current = 'all';

      const alphabet = q => (input.value || '').trim().toLowerCase().includes(q);

      function render(scroll) {
        const query = (input.value || '').trim().toLowerCase();
        let total = 0;
        for (const section of sections) {
          const allowed = current === 'all' || section.dataset.cat === current;
          let visible = 0;
          if (allowed) {
            for (const card of section.querySelectorAll('.gcard')) {
              const hit = !query || (card.dataset.search || '').toLowerCase().includes(query);
              card.hidden = !hit;
              if (hit) visible++;
            }
          }
          total += visible;
          section.hidden = !allowed || visible === 0;
          const badge = section.querySelector('.gcount-badge');
          if (badge) badge.textContent = visible;
        }
        for (const chip of chips) chip.setAttribute('aria-pressed', String(chip.dataset.filter === current));
        counter.textContent = String(total);
        empty.hidden = total > 0;
        if (scroll) {
          const target = current === 'all' ? document.querySelector('.guide-hero') : sections.find(s => s.dataset.cat === current);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      for (const chip of chips) chip.addEventListener('click', () => {
        current = chip.dataset.filter;
        if (current !== 'all') history.replaceState(null, '', '#' + current);
        else history.replaceState(null, '', location.pathname + location.search);
        input.value = '';
        render(true);
      });
      input.addEventListener('input', () => render(false));
      input.addEventListener('search', () => render(false));
      render(false);
    })();
