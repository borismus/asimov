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

  log() {
    console.log("[Timeline]: ", ...arguments);
  }

  connectedCallback() {
    // this.log("Custom element added to page.");
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

    // Setup random button.
    this.shadowRoot.querySelector("#random").addEventListener("click", (e) => {
      this.emitNavigateEvent(this.getRandomCardID());
    });

    if (isMobile()) {
      this.setAttribute("collapsed", "true");
    }
  }

  disconnectedCallback() {
    // this.log("Custom element removed from page.");
  }

  adoptedCallback() {
    // this.log("Custom element moved to new page.");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    // this.log(`Attribute ${name} has changed from ${oldValue} to ${newValue}.`);

    if (name === "nodes") {
      // Populate with field data.
      if (!this.fieldsPopulated) {
        this.renderFields();
      }

      // Populate with node data only after we have nodes.
      this.renderAllNodes();
    }

    if (name === "focus") {
      // this.renderNodes();
      this.focusNode(oldValue, newValue);
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

  focusNode(oldValue, newValue) {
    // Scroll to the focus node.
    const allNodesEl = this.shadowRoot.querySelector(
      "ul#inventions-discoveries"
    );
    const oldEl = allNodesEl.querySelector(`.invention-${oldValue}`);
    if (oldEl) {
      oldEl.classList.remove("focus");
    }
    const newEl = allNodesEl.querySelector(`.invention-${newValue}`);
    newEl.classList.add("focus");

    newEl.scrollIntoView({ behavior: "instant", block: "center" });
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

  renderAllNodes() {
    const nodes = JSON.parse(this.getAttribute("nodes"));
    this.renderNodesHelper(nodes);
  }

  renderNodesHelper(nodes) {
    const allNodesEl = this.shadowRoot.querySelector(
      "ul#inventions-discoveries"
    );
    allNodesEl.innerHTML = "";
    allNodesEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.stopPropagation();
        e.preventDefault();
        return false;
      }
    });
    for (const node of nodes) {
      const nodeEl = document.createElement("li");
      nodeEl.classList.add(`invention-${node.id}`);
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

      nodeEl.addEventListener("click", () => {
        this.emitNavigateEvent(node.id);
      });

      allNodesEl.appendChild(nodeEl);
    }

    // Summary.
    const nodeEl = document.createElement("li");
    nodeEl.className = "total";
    const labelEl = document.createElement("label");
    labelEl.textContent = "Total";
    nodeEl.appendChild(labelEl);

    const countEl = document.createElement("span");
    countEl.className = "count";
    countEl.textContent = nodes.length;
    nodeEl.appendChild(countEl);
    allNodesEl.appendChild(nodeEl);
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

    this.renderAllNodes();

    this.fieldsPopulated = true;
  }

  getRandomCardID() {
    const nodes = JSON.parse(this.getAttribute("nodes"));
    const rand = Math.floor(Math.random() * nodes.length);
    return nodes[rand].id;
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

customElements.define("asimov-timeline", Timeline);
