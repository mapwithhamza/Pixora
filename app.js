// Easy Image Editor - Updated app.js (compatible with the new CSS)

class ImageEditor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.originalImage = null;
    this.currentImage = null;

    this.state = {
      filters: {
        brightness: 100,
        saturation: 100,
        contrast: 100,
        grayscale: 0,
      },
      transforms: {
        rotation: 0,
        flipHorizontal: false,
        flipVertical: false,
      },
      sidebarVisible: true,
      theme: this.getStoredTheme(),
    };

    this.elements = {};
    this._filterUpdateTimeouts = {}; // For debouncing / managing .updating per filter

    this.prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    this.init();
  }

  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.applyTheme(); // sets icon + root data-theme
    this.updateUI();
    this.updateAllSliderFills(); // initial slider visuals
  }

  cacheElements() {
    this.elements = {
      app: document.getElementById("app"),
      canvas: document.getElementById("canvas"),
      canvasContainer: document.getElementById("canvasContainer"),
      placeholder: document.getElementById("placeholder"),
      sidebar: document.getElementById("sidebar"),
      sidebarToggle: document.getElementById("sidebarToggle"),
      sidebarHandle: document.getElementById("sidebarHandle"),
      imageUpload: document.getElementById("imageUpload"),

      themeToggle: document.getElementById("themeToggle"),
      themeIcon: document.getElementById("themeIcon"),

      filterSliders: {
        brightness: document.getElementById("brightnessSlider"),
        saturation: document.getElementById("saturationSlider"),
        contrast: document.getElementById("contrastSlider"),
        grayscale: document.getElementById("grayscaleSlider"),
      },
      filterValues: {
        brightness: document.getElementById("brightnessValue"),
        saturation: document.getElementById("saturationValue"),
        contrast: document.getElementById("contrastValue"),
        grayscale: document.getElementById("grayscaleValue"),
      },

      rotateLeft: document.getElementById("rotateLeft"),
      rotateRight: document.getElementById("rotateRight"),
      flipHorizontal: document.getElementById("flipHorizontal"),
      flipVertical: document.getElementById("flipVertical"),

      chooseBtn: document.getElementById("chooseBtn"),
      resetBtn: document.getElementById("resetBtn"),
      saveBtn: document.getElementById("saveBtn"),
    };

    this.canvas = this.elements.canvas;
    this.ctx = this.canvas.getContext("2d");
  }

  setupEventListeners() {
    // Theme toggle with animation class and aria-label
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener("click", () => {
        this.toggleTheme();
      });
    }

    // Sidebar toggle and handle
    if (this.elements.sidebarToggle) {
      this.elements.sidebarToggle.addEventListener("click", () =>
        this.toggleSidebar()
      );
    }
    if (this.elements.sidebarHandle) {
      this.elements.sidebarHandle.addEventListener("click", () =>
        this.toggleSidebar()
      );
    }

    // File input
    if (this.elements.imageUpload) {
      this.elements.imageUpload.addEventListener("change", (e) =>
        this.handleFileSelect(e)
      );
    }

    // Drag & drop
    this.setupDragAndDrop();

    // Filter sliders
    Object.entries(this.elements.filterSliders).forEach(([filter, slider]) => {
      if (!slider) return;
      slider.addEventListener("input", (e) =>
        this.handleFilterChange(filter, e.target.value)
      );
      // Update fill on input for visual track
      slider.addEventListener("input", () => this.updateSliderFill(slider));
    });

    // Transform buttons
    if (this.elements.rotateLeft) {
      this.elements.rotateLeft.addEventListener("click", () =>
        this.rotateImage(-90)
      );
    }
    if (this.elements.rotateRight) {
      this.elements.rotateRight.addEventListener("click", () =>
        this.rotateImage(90)
      );
    }
    if (this.elements.flipHorizontal) {
      this.elements.flipHorizontal.addEventListener("click", () =>
        this.flipImage("horizontal")
      );
    }
    if (this.elements.flipVertical) {
      this.elements.flipVertical.addEventListener("click", () =>
        this.flipImage("vertical")
      );
    }

    // Action buttons
    if (this.elements.chooseBtn) {
      this.elements.chooseBtn.addEventListener("click", () =>
        this.elements.imageUpload.click()
      );
    }
    if (this.elements.resetBtn) {
      this.elements.resetBtn.addEventListener("click", () => this.resetAll());
    }
    if (this.elements.saveBtn) {
      this.elements.saveBtn.addEventListener("click", () => this.saveImage());
    }

    // Resize
    window.addEventListener("resize", () => this.handleResize());

    // Click outside sidebar for mobile close
    document.addEventListener("click", (e) => this.handleOutsideClick(e));
  }

  // Theme persistence helpers
  getStoredTheme() {
    try {
      return localStorage.getItem("imageEditor-theme") || "light";
    } catch {
      return "light";
    }
  }

  storeTheme() {
    try {
      localStorage.setItem("imageEditor-theme", this.state.theme);
    } catch {
      console.warn("Could not persist theme.");
    }
  }

  toggleTheme() {
    this.state.theme = this.state.theme === "light" ? "dark" : "light";
    this.applyTheme();
    this.storeTheme();
  }

  applyTheme() {
    this.elements.app.setAttribute("data-theme", this.state.theme);

    // Icon swap with class for CSS anim
    if (this.state.theme === "dark") {
      this.elements.themeIcon.className = "fas fa-sun";
      this.elements.themeToggle.classList.add("toggled");
      this.elements.themeToggle.setAttribute(
        "aria-label",
        "Switch to light mode"
      );
    } else {
      this.elements.themeIcon.className = "fas fa-moon";
      this.elements.themeToggle.classList.remove("toggled");
      this.elements.themeToggle.setAttribute(
        "aria-label",
        "Switch to dark mode"
      );
    }
  }

  toggleSidebar() {
    this.state.sidebarVisible = !this.state.sidebarVisible;

    if (this.state.sidebarVisible) {
      this.elements.sidebar.classList.remove("hidden");
      this.elements.sidebarToggle.querySelector("i").className =
        "fas fa-chevron-left";
      this.elements.sidebarHandle.querySelector("i").className =
        "fas fa-chevron-left";
      this.elements.sidebarToggle.setAttribute("aria-expanded", "true");
    } else {
      this.elements.sidebar.classList.add("hidden");
      this.elements.sidebarToggle.querySelector("i").className =
        "fas fa-chevron-right";
      this.elements.sidebarHandle.querySelector("i").className =
        "fas fa-chevron-right";
      this.elements.sidebarToggle.setAttribute("aria-expanded", "false");
    }
  }

  setupDragAndDrop() {
    const container = this.elements.canvasContainer;
    if (!container) return;

    ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) => {
      container.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach((ev) => {
      container.addEventListener(ev, () => {
        container.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach((ev) => {
      container.addEventListener(ev, () => {
        container.classList.remove("drag-over");
      });
    });

    container.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleFile(files[0]);
      }
    });
  }

  handleResize() {
    if (this.currentImage) {
      this.setupCanvas();
      this.drawImage();
    }
  }

  handleOutsideClick(e) {
    if (window.innerWidth <= 1024) {
      const sidebar = this.elements.sidebar;
      const toggle = this.elements.sidebarToggle;
      const handle = this.elements.sidebarHandle;
      const inside = sidebar.contains(e.target);
      const onToggle = toggle.contains(e.target) || handle.contains(e.target);
      if (!inside && !onToggle && this.state.sidebarVisible) {
        this.toggleSidebar();
      }
    }
  }

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) this.handleFile(file);
  }

  handleFile(file) {
    if (!this.validateFile(file)) return;

    const reader = new FileReader();
    reader.onload = (evt) => this.loadImage(evt.target.result);
    reader.onerror = () => {
      this.showError("Error reading file");
    };
    reader.readAsDataURL(file);
  }

  validateFile(file) {
    const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!supported.includes(file.type)) {
      this.showError("Unsupported format. Use JPG, PNG, GIF or WebP.");
      return false;
    }
    const max = 10 * 1024 * 1024;
    if (file.size > max) {
      this.showError("File too large. Max 10MB.");
      return false;
    }
    return true;
  }

  showError(msg) {
    // Minimal error display; could be replaced with toast
    alert(msg);
  }

  loadImage(src) {
    const img = new Image();
    img.onload = () => {
      this.originalImage = img;
      this.currentImage = img;
      this.setupCanvas();
      this.showImage();
      this.resetAll();
    };
    img.onerror = () => this.showError("Error loading image");
    img.src = src;
  }

  setupCanvas() {
    if (!this.originalImage) return;
    const container = this.elements.canvasContainer;
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;

    let { width, height } = this.originalImage;
    const scale = Math.min(containerWidth / width, containerHeight / height, 1);

    this.canvas.width = width * scale;
    this.canvas.height = height * scale;

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  showImage() {
    if (this.elements.placeholder)
      this.elements.placeholder.style.opacity = "0";
    this.elements.canvas.style.display = "block";
    setTimeout(() => {
      if (this.elements.placeholder)
        this.elements.placeholder.style.display = "none";
    }, 300);
    this.drawImage();
  }

  drawImage() {
    if (!this.currentImage) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this.ctx.translate(centerX, centerY);

    if (this.state.transforms.rotation !== 0) {
      this.ctx.rotate((this.state.transforms.rotation * Math.PI) / 180);
    }

    const scaleX = this.state.transforms.flipHorizontal ? -1 : 1;
    const scaleY = this.state.transforms.flipVertical ? -1 : 1;
    this.ctx.scale(scaleX, scaleY);

    this.ctx.drawImage(
      this.currentImage,
      -this.canvas.width / 2,
      -this.canvas.height / 2,
      this.canvas.width,
      this.canvas.height
    );

    this.ctx.restore();

    // Apply CSS filters for preview
    this.applyFilters();
  }

  getFilterString() {
    const { brightness, saturation, contrast, grayscale } = this.state.filters;
    return `brightness(${brightness}%) saturate(${saturation}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
  }

  applyFilters() {
    const filterStr = this.getFilterString();
    // Slight delay to smooth rapid slider dragging (perceived)
    if (this.prefersReducedMotion) {
      this.canvas.style.filter = filterStr;
    } else {
      // use requestAnimationFrame to batch updates
      requestAnimationFrame(() => {
        this.canvas.style.filter = filterStr;
      });
    }
  }

  handleFilterChange(filterType, value) {
    // normalize
    const intVal = parseInt(value);
    this.state.filters[filterType] = intVal;
    this.updateFilterValue(filterType, intVal);
    this.updateSliderFill(this.elements.filterSliders[filterType]);

    // visual feedback: cancel previous timer for this filter
    if (this._filterUpdateTimeouts[filterType]) {
      clearTimeout(this._filterUpdateTimeouts[filterType]);
    }

    const filterItem =
      this.elements.filterSliders[filterType].closest(".filter-item");
    if (filterItem) {
      filterItem.classList.add("updating");
      this._filterUpdateTimeouts[filterType] = setTimeout(() => {
        filterItem.classList.remove("updating");
        delete this._filterUpdateTimeouts[filterType];
      }, 300);
    }

    if (this.currentImage) {
      this.applyFilters();
    }
  }

  updateFilterValue(filterType, value) {
    const el = this.elements.filterValues[filterType];
    if (el) {
      el.textContent = value + "%";
    }
  }

  updateSliderFill(slider) {
    if (!slider) return;
    const val = slider.value;
    // Visual gradient track fill from left up to thumb
    const percentage = ((val - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background = `linear-gradient(90deg, var(--accent-primary) ${percentage}%, var(--border-color) ${percentage}%)`;
  }

  updateAllSliderFills() {
    Object.values(this.elements.filterSliders).forEach((s) =>
      this.updateSliderFill(s)
    );
  }

  rotateImage(deg) {
    if (!this.currentImage) return;
    this.state.transforms.rotation =
      (this.state.transforms.rotation + deg) % 360;
    this.drawImage();
  }

  flipImage(direction) {
    if (!this.currentImage) return;
    if (direction === "horizontal") {
      this.state.transforms.flipHorizontal =
        !this.state.transforms.flipHorizontal;
    } else if (direction === "vertical") {
      this.state.transforms.flipVertical = !this.state.transforms.flipVertical;
    }
    this.drawImage();
  }

  resetAll() {
    // Reset filters/transforms
    this.state.filters = {
      brightness: 100,
      saturation: 100,
      contrast: 100,
      grayscale: 0,
    };
    this.state.transforms = {
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
    };

    this.updateUI();
    if (this.currentImage) {
      this.drawImage();
    }
  }

  updateUI() {
    Object.entries(this.state.filters).forEach(([filter, value]) => {
      const slider = this.elements.filterSliders[filter];
      if (slider) {
        slider.value = value;
        this.updateSliderFill(slider);
      }
      this.updateFilterValue(filter, value);
    });
  }

  saveImage() {
    if (!this.currentImage) {
      this.showError("No image to save");
      return;
    }

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = this.originalImage.width;
    tempCanvas.height = this.originalImage.height;

    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = "high";
    tempCtx.save();

    const centerX = tempCanvas.width / 2;
    const centerY = tempCanvas.height / 2;
    tempCtx.translate(centerX, centerY);

    if (this.state.transforms.rotation !== 0) {
      tempCtx.rotate((this.state.transforms.rotation * Math.PI) / 180);
    }

    const scaleX = this.state.transforms.flipHorizontal ? -1 : 1;
    const scaleY = this.state.transforms.flipVertical ? -1 : 1;
    tempCtx.scale(scaleX, scaleY);

    tempCtx.filter = this.getFilterString();
    tempCtx.drawImage(
      this.originalImage,
      -tempCanvas.width / 2,
      -tempCanvas.height / 2,
      tempCanvas.width,
      tempCanvas.height
    );
    tempCtx.restore();

    tempCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `edited-image-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      "image/png",
      1.0
    );
  }
}

// initialize when ready
document.addEventListener("DOMContentLoaded", () => {
  new ImageEditor();
});
