class Link {
    constructor(value, closed = false) {
      this.closed = closed;
      this.value = value;
      this.after = (closed ? this : undefined);
      this.before = (closed ? this : undefined);
    }
  
    addAfter(value) {
      const displaced = this.after;
      const newLink = new this.constructor(value);
      this.after = newLink;
      newLink.before = this;
      newLink.after = displaced;
      if (displaced) displaced.before = newLink;
      return this.after;
    }
  
    addBefore(value) {
      const displaced = this.before;
      const newLink = new this.constructor(value);
      this.before = newLink;
      newLink.after = this;
      newLink.before = displaced;
      if (displaced) displaced.after = newLink;
      return this.before;
    }
  
    get chainSize() {
      let link = this;
      let size = 1;
      while (link = link.before) {
        if (link == this) return size;
        size++;
      }
      link = this;
      while (link = link.after) {
        if (link == this) return size;
        size++;
      }
      return size;
    }
  
    get first() {
      if (this.closed) return undefined;
      let link = this;
      while (link.before) {
        link = link.before;
      }
      return link;
    }
  
    get last() {
      if (this.closed) return undefined;
      let link = this;
      while (link.after) {
        link = link.after;
      }
      return link;
    }
  
    next(q = 1) {
      let link = this;
      let i = 0;
      while (i++ < q) {
        link = link.after;
        if (!link) break;
      }
      return link;
    }
  
    previous(q = 1) {
      let link = this;
      let i = 0;
      while (i++ < q) {
        link = link.before;
        if (!link) break;
      }
      return link;
    }
  
    remove(after = true) {
      if (this.before) this.before.after = this.after;
      if (this.after) this.after.before = this.before;
      return (after ? this.after : this.before);
    }
  }
  
  class USet extends Set {
    constructor(...args) {
      super(...args);
    }
  
    clone() {
      return new USet([...this]);
    }
  
    deleteIndex(index) {
      this.delete(this.getIndex(index));
      return this;
    }
  
    filter(fn) {
      const filtered = new USet();
      for (const value of this) {
        if (fn(value)) filtered.add(value);
      }
      return filtered;
    }
  
    find(fn) {
      for (const value of this) {
        if (fn(value)) return value;
      }
      return null;
    }
  
    first(n) {
      if (n !== undefined) {
        let values = new Array(Math.min(parseInt(n, 10), this.size));
        let i = 0;
        for (const value of this) {
          values[i++] = value;
          if (i >= n) break;
        }
        return values;
      } else {
        for (const value of this) {
          return value;
        }
      }
    }
  
    getIndex(index) {
      return [...this][index];
    }
  
    map(fn) {
      return [...this].map(fn);
    }
  
    random() {
      // Get a random element
      let index = Math.floor(Math.random() * this.size);
      let i = 0;
      for (const value of this) {
        if (index == i++) return value;
      }
    }
  
    reduce(fn, value) {
      return [...this].reduce(fn, value);
    }
  
    sort(fn) {
      return [...this].sort(fn);
    }
  }
  
  module.exports = {
    Link,
    USet
  };