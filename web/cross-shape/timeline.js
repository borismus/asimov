function getTemplate(templateId) {
  const templates = Array.from(document.getElementsByTagName("template"));
  templates.filter((template) => template.id === templateId);
  return templates[0];
}

class Timeline extends HTMLElement {
  static observedAttributes = ["focus", "nodes"];

  constructor() {
    // Always call super first in constructor
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    console.log("Custom element added to page.");
    const template = getTemplate("asimov-timeline");
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  disconnectedCallback() {
    console.log("Custom element removed from page.");
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    console.log(
      `Attribute ${name} has changed from ${oldValue} to ${newValue}.`
    );
  }

  render() {}
}

customElements.define("asimov-timeline", Timeline);
