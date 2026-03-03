export function debounce(fn, wait = 400) {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), wait);
  };

  debounced.cancel = () => {
    clearTimeout(timeoutId);
  };

  return debounced;
}
