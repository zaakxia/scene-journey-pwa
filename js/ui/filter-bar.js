// Filter bar component
const FilterBar = (() => {

  function render(container, options, onChange) {
    const html = options.map((opt, i) =>
      `<button class="filter-chip${i === 0 ? ' active' : ''}" data-value="${opt.value}">${opt.label}</button>`
    ).join('');

    container.innerHTML = `<div class="filter-bar">${html}</div>`;

    container.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const value = chip.dataset.value === 'all' ? null : chip.dataset.value;
        if (onChange) onChange(value);
      });
    });
  }

  function getFilterOptions(locations) {
    const cities = [...new Set(locations.map(l => l.city))];
    const cityOptions = cities.map(c => ({ label: c, value: c }));
    return [
      { label: '全部', value: 'all' },
      ...cityOptions
    ];
  }

  return { render, getFilterOptions };
})();
