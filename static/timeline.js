import { formatField, formatYear, isMobile } from "./utils.js";

function getTemplate(templateId) {
  const templates = Array.from(document.getElementsByTagName("template"));
  templates.filter((template) => template.id === templateId);
  return templates[0];
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

class Timeline extends HTMLElement {
  static observedAttributes = ["focus", "nodes", "collapsed"];

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
    // Setup collapse/expand button.
    this.shadowRoot
      .querySelector("#collapse-expand")
      .addEventListener("click", (e) => {
        this.setAttribute(
          "collapsed",
          this.getAttribute("collapsed") === "true" ? "false" : "true"
        );
      });

    if (isMobile()) {
      this.setAttribute("collapsed", "true");
    }
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

    if (name === "collapsed") {
      const isNowCollapsed = newValue === "true";
      this.shadowRoot.querySelector("#container").className = isNowCollapsed
        ? "collapsed"
        : "";

      gtag("event", "timeline-visible", {
        visible: !isNowCollapsed,
      });
    }
  }

  emitNavigateEvent(id) {
    const event = new CustomEvent("navigate", {
      detail: { id },
    });
    this.dispatchEvent(event);
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
    if (!focus) {
      return;
    }

    const allNodesEl = this.shadowRoot.querySelector(
      "ul#inventions-discoveries"
    );
    allNodesEl.innerHTML = "";

    // Find the focus node in the list of nodes.
    let focusIndex = nodes.findIndex((node) => node.id === focus);
    if (focusIndex === -1) {
      console.warn(`Focused node ${focus} not found in ${nodes.length} nodes.`);
      return;
    }

    const count = isMobile() ? 3 : 5;
    const nodeIndices = getIndicesNear(focusIndex, nodes.length, count);

    for (const index of nodeIndices) {
      const node = nodes[index];
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
      fieldEl.src = `/static/images/fields/${formatField(node.field)}.png`;
      fieldEl.className = "field";
      nodeEl.appendChild(fieldEl);

      if (index === focusIndex) {
        nodeEl.classList.add("focus");
      }

      nodeEl.addEventListener("click", () => {
        this.emitNavigateEvent(node.id);
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
    noneField.textContent = "All fields";
    allFieldsEl.appendChild(noneField);

    fields.map((field) => {
      const fieldEl = document.createElement("option");
      fieldEl.value = field;
      fieldEl.textContent = capitalizeFirstLetter(field);
      allFieldsEl.appendChild(fieldEl);
    });
    this.fieldsPopulated = true;
  }

  resetFilters() {
    const queryEl = this.shadowRoot.querySelector("#query");
    if (queryEl.value) {
      // Make an animation of clearing
      queryEl.value = "";
      queryEl.classList.add("clearing");
      setTimeout(() => {
        queryEl.classList.remove("clearing");
      }, 1000);
    }
    const fieldsEl = this.shadowRoot.querySelector("#fields");
    if (fieldsEl.value) {
      fieldsEl.value = "";
      fieldsEl.classList.add("clearing");
      setTimeout(() => {
        fieldsEl.classList.remove("clearing");
      }, 1000);
    }
  }

  focusSearch() {
    this.shadowRoot.querySelector("#query").focus();
  }
}

function getIndicesNear(focusIndex, total, count) {
  let nodeIndices = [];
  nodeIndices.push(focusIndex);

  let offset = 1;
  if (total < count) {
    let range = (n) => Array.from(Array(n).keys());
    nodeIndices = range(total);
  } else {
    while (nodeIndices.length < count) {
      if (focusIndex + offset < total) {
        nodeIndices.push(focusIndex + offset);
      }
      if (focusIndex - offset >= 0) {
        nodeIndices.push(focusIndex - offset);
      }
      offset++;
    }
    nodeIndices = nodeIndices.sort((a, b) => a - b);
  }
  return nodeIndices;
}

customElements.define("asimov-timeline", Timeline);
