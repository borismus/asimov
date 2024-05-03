import { formatField, formatYear } from "../utils.js";

function getTemplate(templateId) {
  const templates = Array.from(document.getElementsByTagName("template"));
  templates.filter((template) => template.id === templateId);
  return templates[0];
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
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

    // Setup search field.
    this.shadowRoot.querySelector("#query").addEventListener("input", (e) => {
      this.emitFilterEvent();
    });

    // Setup field filter.
    this.shadowRoot.querySelector("#fields").addEventListener("change", (e) => {
      this.emitFilterEvent();
    });
  }

  disconnectedCallback() {
    console.log("Custom element removed from page.");
  }

  adoptedCallback() {
    console.log("Custom element moved to new page.");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // console.log(
    //   `Attribute ${name} has changed from ${oldValue} to ${newValue}.`
    // );

    if (name === "nodes") {
      // Populate with field data.
      if (!this.fieldsPopulated) {
        this.renderFields();
      }

      // Populate with node data.
      this.renderNodes();
    }

    if (name === "focus") {
      this.renderNodes();
    }
  }

  emitFilterEvent() {
    const event = new CustomEvent("filter", {
      detail: {
        query: this.shadowRoot.querySelector("#query").value,
        field: this.shadowRoot.querySelector("#fields").value,
      },
    });
    this.dispatchEvent(event);
  }

  renderNodes() {
    const nodes = JSON.parse(this.getAttribute("nodes"));
    const focus = this.getAttribute("focus");

    // Find the focus node in the list of nodes.
    const focusIndex = nodes.findIndex((node) => node.id === focus);
    console.log(focusIndex);

    const allNodesEl = this.shadowRoot.querySelector(
      "ul#inventions-discoveries"
    );
    allNodesEl.innerHTML = "";

    const range = [
      Math.max(0, focusIndex - 2),
      Math.min(nodes.length - 1, focusIndex + 2),
    ];
    for (let i = range[0]; i <= range[1]; i++) {
      const node = nodes[i];
      const nodeEl = document.createElement("li");
      const dateEl = document.createElement("span");
      dateEl.className = "date";
      dateEl.textContent = formatYear(node.year);
      nodeEl.appendChild(dateEl);

      const titleEl = document.createElement("span");
      titleEl.className = "title";
      titleEl.textContent = node.title;
      nodeEl.appendChild(titleEl);

      const fieldEl = document.createElement("img");
      fieldEl.src = `/images/fields/${formatField(node.field)}.png`;
      fieldEl.className = "field";
      nodeEl.appendChild(fieldEl);

      if (i === focusIndex) {
        nodeEl.classList.add("focus");
      }

      nodeEl.addEventListener("click", () => {
        window.location.hash = node.id;
      });

      allNodesEl.appendChild(nodeEl);
    }
  }

  renderFields() {
    const nodes = JSON.parse(this.getAttribute("nodes"));
    const fields = [...new Set(nodes.map((node) => formatField(node.field)))];
    const allFieldsEl = this.shadowRoot.querySelector("#fields");
    allFieldsEl.innerHTML = "";

    const noneField = document.createElement("option");
    noneField.value = "";
    noneField.textContent = "All Fields";
    allFieldsEl.appendChild(noneField);

    fields.map((field) => {
      const fieldEl = document.createElement("option");
      fieldEl.value = field;
      fieldEl.textContent = capitalizeFirstLetter(field);
      allFieldsEl.appendChild(fieldEl);
    });
    this.fieldsPopulated = true;
  }
}

customElements.define("asimov-timeline", Timeline);
