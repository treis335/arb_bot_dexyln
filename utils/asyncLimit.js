function asyncLimit(concurrency) {
  let running = 0;
  const queue = [];
  const runNext = () => {
    if (queue.length && running < concurrency) {
      const { fn, resolve, reject } = queue.shift();
      running++;
      fn().then(resolve, reject).finally(() => {
        running--;
        runNext();
      });
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    runNext();
  });
}
module.exports = asyncLimit;