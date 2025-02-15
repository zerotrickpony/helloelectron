// Utility for building and manipulating the browser DOM concisely.

export class DomBox {
  cursor: HTMLElement;

  // Starts a new HTML cursor that adds items to the given parent.
  static at(cursor: HTMLElement): DomBox {
    return new DomBox(cursor);
  }

  // Starts a new HTML cursor that adds items to the document body.
  static onBody(): DomBox {
    return new DomBox(DomBox.findBody());
  }

  // Starts a new HTML cursor that adds items to the existing element with the given ID.
  static onId(id: string): DomBox {
    return new DomBox(DomBox.findId(id));
  }

  // Modifies the given node using this builder wrapper.
  constructor(cursor: HTMLElement) {
    this.cursor = cursor;
  }

  // Creates a child node at the cursor element and returns a new cursor for it.
  add(spec: string): DomBox {
    const node = this.addBelow(spec);
    return new DomBox(node);
  }

  // Same as above, but doesn't create a new builder for the newly created child node.
  addBelow(spec: string): HTMLElement {
    const node = document.createElement('span');  // this doesnt matter because it will be replaced
    this.cursor.appendChild(node);
    node.outerHTML = spec;
    return this.cursor.lastChild as HTMLElement;
  }

  // Returns the element at the cursor
  get(): HTMLElement {
    return this.cursor;
  }

  // Sets the innerText of the element at the cursor.
  text(text: string): this {
    this.cursor.innerText = text;
    return this;
  }

  // Sets the innerHTML of the element at the cursor.
  html(html: string): this {
    this.cursor.innerHTML = html;
    return this;
  }

  // Installs a click handler, replacing other click handlers.
  click(fn: (e: MouseEvent) => Promise<any>): this {
    this.cursor.onclick = fn;
    return this;
  }

  // Adds an event listener for the given event type.
  on(eventType: string, fn: (e: Event) => any): this {
    this.cursor.addEventListener(eventType, fn);
    return this;
  }

  // Returns true if the cursor element has the "checked" attribute.
  isChecked(): boolean {
    const attr = this.cursor.getAttribute('checked');
    return !!attr;  // any presence of a string attribute value would be considered true
  }

  // Shows an element that was previously hidden with hide()
  show(showCondition = true): this {
    if (showCondition) {
      this.cursor.classList.remove('hidden-element');
    } else {
      this.cursor.classList.add('hidden-element');
    }
    return this;
  }

  // Styles the element away using the CSS class "hidden-element"
  hide(): this {
    this.cursor.classList.add('hidden-element');
    return this;
  }

  // Removes this node from its parent. Should be the last thing that happens.
  remove(): void {
    this.cursor.remove();
  }

  // Returns a new cursor at the parent node.
  up(): DomBox {
    const parent = this.cursor.parentElement;
    if (parent) {
      return new DomBox(parent);
    } else {
      throw new Error(`No parent at this node`);
    }
  }

  static findId(id: string): HTMLElement {
    const node = document.getElementById(id);
    if (!node) {
      throw new Error(`No such ID: ${id}`);
    }
    return node;
  }

  static findBody(): HTMLElement {
    const nodes = document.getElementsByTagName('BODY');
    if (nodes.length < 1) {
      throw new Error(`Failed to find body element`);
    }
    return nodes[0] as HTMLElement;
  }
}
