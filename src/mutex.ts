// https://www.reddit.com/r/javascript/comments/1etp4az/askjs_the_most_simplest_javascript_mutex/
export class Mutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    return new Promise((resolve) => {
      this.mutex = this.mutex.then(() => new Promise(resolve));
    });
  }
}