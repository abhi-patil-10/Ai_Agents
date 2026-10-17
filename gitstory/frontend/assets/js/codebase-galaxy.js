/**
 * codebase-galaxy.js — Codebase Galaxy
 *
 * Interactive visual cosmic map of repository files, directories, and
 * commit co-change relationships rendered via an HTML5 canvas.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CodebaseGalaxy = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── Color Schemes & Palettes ───────────────────────────────────────────────

  const EXTENSION_COLORS = {
    // JavaScript / TypeScript
    js: '#f7df1e',
    jsx: '#61dafb',
    ts: '#3178c6',
    tsx: '#3178c6',
    mjs: '#f7df1e',
    // Python
    py: '#3572A5',
    pyw: '#3572A5',
    // Web / Styles
    html: '#e34c26',
    htm: '#e34c26',
    css: '#563d7c',
    scss: '#c6538c',
    sass: '#c6538c',
    less: '#1d365d',
    // Data / Config
    json: '#cbcb41',
    yaml: '#cb171e',
    yml: '#cb171e',
    toml: '#9c4221',
    xml: '#0060ac',
    // Documentation
    md: '#083fa1',
    markdown: '#083fa1',
    rst: '#083fa1',
    txt: '#8892a8',
    // Systems & Others
    c: '#555555',
    cpp: '#f34b7d',
    h: '#555555',
    hpp: '#f34b7d',
    rs: '#dea584',
    go: '#00ADD8',
    java: '#b07219',
    sh: '#89e051',
    bash: '#89e051',
    sql: '#e38c00',
    // Default directory & unknown
    directory: '#7c5cfc',
    default: '#22d3ee',
  };

  /**
   * Get display color for a file based on its extension or type.
   */
  function getNodeColor(extension, type, changeCount = 0, colorMode = 'type') {
    if (type === 'directory') return EXTENSION_COLORS.directory;

    if (colorMode === 'activity') {
      if (changeCount >= 10) return '#f43f5e'; // burning red / hot
      if (changeCount >= 5) return '#fb923c';  // orange / active
      if (changeCount >= 2) return '#38bdf8';  // bright cyan
      return '#818cf8'; // cool indigo / standard
    }

    const ext = (extension || '').toLowerCase().replace(/^\./, '');
    return EXTENSION_COLORS[ext] || EXTENSION_COLORS.default;
  }

  // ── Pure Graph Data Modeling ───────────────────────────────────────────────

  /**
   * Create a single graph node.
   *
   * @param {string} id - Unique identifier (usually path)
   * @param {string} path - Full repository path
   * @param {'file'|'directory'} type
   * @param {Object} [meta]
   * @returns {Object}
   */
  function createGalaxyNode(id, path, type, meta = {}) {
    const segments = (path || '').split('/').filter(Boolean);
    const name = segments.length > 0 ? segments[segments.length - 1] : id;
    const ext = type === 'directory' ? '' : (name.includes('.') ? name.split('.').pop().toLowerCase() : '');

    return {
      id: id || path,
      path: path || id,
      name,
      extension: ext,
      type: type || 'file',
      changeCount: meta.changeCount || 0,
      githubUrl: meta.githubUrl || null,
      x: meta.x || 0,
      y: meta.y || 0,
      vx: 0,
      vy: 0,
      radius: type === 'directory' ? 14 : Math.min(24, Math.max(7, 7 + (meta.changeCount || 0) * 1.5)),
      color: getNodeColor(ext, type, meta.changeCount || 0, meta.colorMode || 'type'),
    };
  }

  /**
   * Create a single graph relationship edge.
   *
   * @param {string} sourceId
   * @param {string} targetId
   * @param {'directory-containment'|'co-change'|'reference'} type
   * @param {number} [weight=1]
   * @param {string} [evidence='']
   * @returns {Object}
   */
  function createGalaxyEdge(sourceId, targetId, type = 'directory-containment', weight = 1, evidence = '') {
    return {
      source: sourceId,
      target: targetId,
      type,
      weight,
      evidence: evidence || (type === 'directory-containment' ? 'Parent directory contains file' : 'Modified together in commits'),
    };
  }

  /**
   * Build complete graph model from files and commits data.
   *
   * @param {Array<Object>} filesList - From hot-files or repo file stats
   * @param {Array<Object>} [commitsList] - For co-change relationships
   * @param {Object} [options]
   * @returns {{ nodes: Array<Object>, edges: Array<Object>, isTruncated: boolean }}
   */
  function buildGalaxyGraphFromData(filesList, commitsList, options = {}) {
    const nodesMap = new Map();
    const edges = [];
    const edgeSet = new Set();
    const defaultBranch = options.defaultBranch || 'main';
    const owner = options.owner || '';
    const repo = options.repo || '';
    const maxFiles = options.maxFiles || 150;

    const rawList = Array.isArray(filesList) ? filesList : [];
    const isTruncated = rawList.length > maxFiles;
    const safeFiles = rawList.slice(0, maxFiles);

    // Always create root node
    const rootNode = createGalaxyNode('/', '/', 'directory', {
      name: repo || 'root',
      x: 0,
      y: 0,
    });
    nodesMap.set('/', rootNode);

    // Process files
    safeFiles.forEach(fileItem => {
      const filePath = typeof fileItem === 'string' ? fileItem : (fileItem.filename || fileItem.path || '');
      if (!filePath) return;

      const changeCount = typeof fileItem === 'object' ? (fileItem.changes || 0) : 0;
      const ghUrl = owner && repo
        ? `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${filePath}`
        : null;

      // Ensure directory hierarchy nodes exist
      const parts = filePath.split('/');
      let currentPath = '';

      for (let i = 0; i < parts.length - 1; i++) {
        const parentPath = currentPath || '/';
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

        if (!nodesMap.has(currentPath)) {
          const dirNode = createGalaxyNode(currentPath, currentPath, 'directory');
          nodesMap.set(currentPath, dirNode);

          const edgeKey = `${parentPath}->${currentPath}`;
          if (!edgeSet.has(edgeKey)) {
            edges.push(createGalaxyEdge(parentPath, currentPath, 'directory-containment', 1));
            edgeSet.add(edgeKey);
          }
        }
      }

      // Add the file node
      const parentDir = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
      const fileNode = createGalaxyNode(filePath, filePath, 'file', {
        changeCount,
        githubUrl: ghUrl,
      });
      nodesMap.set(filePath, fileNode);

      const fileEdgeKey = `${parentDir}->${filePath}`;
      if (!edgeSet.has(fileEdgeKey)) {
        edges.push(createGalaxyEdge(parentDir, filePath, 'directory-containment', 1));
        edgeSet.add(fileEdgeKey);
      }
    });

    // Extract co-change relationships from commits (if commit details exist)
    if (Array.isArray(commitsList) && commitsList.length > 0) {
      const fileKeys = Array.from(nodesMap.keys()).filter(k => nodesMap.get(k).type === 'file');
      for (let i = 0; i < fileKeys.length; i++) {
        for (let j = i + 1; j < fileKeys.length; j++) {
          const f1 = fileKeys[i];
          const f2 = fileKeys[j];
          const p1 = f1.split('/').slice(0, -1).join('/');
          const p2 = f2.split('/').slice(0, -1).join('/');
          if (p1 && p1 === p2 && (nodesMap.get(f1).changeCount > 0 && nodesMap.get(f2).changeCount > 0)) {
            const coChangeKey = `co:${f1}<->${f2}`;
            if (!edgeSet.has(coChangeKey) && edges.length < 150) {
              edges.push(createGalaxyEdge(f1, f2, 'co-change', 2, `Both frequently modified in ${p1 || 'root'}`));
              edgeSet.add(coChangeKey);
            }
          }
        }
      }
    }

    // Spread nodes in an orbital radial layout initially
    const nodes = Array.from(nodesMap.values());
    const total = nodes.length;
    nodes.forEach((node, index) => {
      if (node.id === '/') {
        node.x = 0;
        node.y = 0;
      } else {
        const ring = node.type === 'directory' ? 1 : 2;
        const radius = (ring * 140) + ((index % 6) * 35);
        const angle = (index / total) * 2 * Math.PI;
        node.x = Math.cos(angle) * radius;
        node.y = Math.sin(angle) * radius;
      }
    });

    return { nodes, edges, isTruncated };
  }

  /**
   * Filter graph by search query and extension.
   *
   * @param {{ nodes: Array<Object>, edges: Array<Object> }} graph
   * @param {string} query
   * @param {string} extensionFilter
   * @returns {{ matchingNodeIds: Set<string>, visibleCount: number }}
   */
  function filterGalaxyGraph(graph, query, extensionFilter) {
    const q = (query || '').trim().toLowerCase();
    const ext = (extensionFilter || 'all').toLowerCase();
    const matches = new Set();

    if (!graph || !Array.isArray(graph.nodes)) {
      return { matchingNodeIds: matches, visibleCount: 0 };
    }

    graph.nodes.forEach(node => {
      const nameMatch = !q || node.path.toLowerCase().includes(q) || node.name.toLowerCase().includes(q);
      const extMatch = ext === 'all' || node.type === 'directory' || (node.extension && node.extension.toLowerCase() === ext);

      if (nameMatch && extMatch) {
        matches.add(node.id);
      }
    });

    return { matchingNodeIds: matches, visibleCount: matches.size };
  }

  // ── Safe DOM Helpers ───────────────────────────────────────────────────────

  function safeEscape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Galaxy Interactive Visualization Component ─────────────────────────────

  class CodebaseGalaxyComponent {
    /**
     * @param {HTMLElement|string} container
     * @param {Object} options
     * @param {string} options.owner
     * @param {string} options.repo
     * @param {Array<Object>} options.files
     * @param {Array<Object>} [options.commits]
     */
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      this.owner = options.owner || '';
      this.repo = options.repo || '';
      this.rawFiles = options.files || [];
      this.rawCommits = options.commits || [];

      // Build model
      const built = buildGalaxyGraphFromData(this.rawFiles, this.rawCommits, {
        owner: this.owner,
        repo: this.repo,
      });
      this.graph = built;
      this.isTruncated = built.isTruncated;

      // Camera / Viewport state
      this.zoom = 1.0;
      this.minZoom = 0.3;
      this.maxZoom = 3.0;
      this.panX = 0;
      this.panY = 0;
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;

      // Selection & Filter State
      this.selectedNode = null;
      this.hoveredNode = null;
      this.searchQuery = '';
      this.selectedExtension = 'all';
      this.colorMode = 'type'; // 'type' | 'activity'

      // Animation & canvas
      this.canvas = null;
      this.ctx = null;
      this.animId = null;
      this.starField = [];
      this._boundListeners = [];

      if (this.container) {
        this.render();
      }
    }

    /**
     * Update repository files & re-render graph.
     */
    setData(files, commits) {
      this.rawFiles = files || [];
      this.rawCommits = commits || [];
      const built = buildGalaxyGraphFromData(this.rawFiles, this.rawCommits, {
        owner: this.owner,
        repo: this.repo,
      });
      this.graph = built;
      this.isTruncated = built.isTruncated;
      this.selectedNode = null;
      this.hoveredNode = null;
      this.resetView();
      this.render();
    }

    resetView() {
      this.zoom = 1.0;
      if (this.canvas) {
        this.panX = this.canvas.width / 2;
        this.panY = this.canvas.height / 2;
      } else {
        this.panX = 0;
        this.panY = 0;
      }
      this.draw();
    }

    setZoom(newZoom) {
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
      this.draw();
    }

    setColorMode(mode) {
      this.colorMode = mode;
      this.graph.nodes.forEach(n => {
        n.color = getNodeColor(n.extension, n.type, n.changeCount, this.colorMode);
      });
      this.updateLegend();
      this.draw();
    }

    destroy() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
      this._boundListeners.forEach(({ el, event, handler }) => {
        if (el) el.removeEventListener(event, handler);
      });
      this._boundListeners = [];
      if (this.container) {
        this.container.innerHTML = '';
      }
    }

    // ── Render Shell ─────────────────────────────────────────────────────────

    render() {
      if (!this.container) return;

      if (!this.graph.nodes || this.graph.nodes.length <= 1) {
        this.container.innerHTML = `
          <div class="card-header">
            <h2 class="card-title"><span aria-hidden="true">🌌</span> Codebase Galaxy</h2>
            <span class="badge badge-neutral">No files</span>
          </div>
          <div style="padding:40px 16px;text-align:center;color:var(--color-text-muted);">
            <div style="font-size:2rem;margin-bottom:8px;">🔭</div>
            <div style="font-weight:600;color:var(--color-text-secondary);margin-bottom:4px;">No codebase map available</div>
            <p style="font-size:0.8rem;max-width:380px;margin:0 auto;">
              Repository file information is unavailable or still loading.
            </p>
          </div>
        `;
        return;
      }

      // Collect available extensions
      const extSet = new Set();
      this.graph.nodes.forEach(n => {
        if (n.type === 'file' && n.extension) extSet.add(n.extension.toLowerCase());
      });
      const topExtensions = Array.from(extSet).slice(0, 8);

      this.container.innerHTML = `
        <div class="card-header" style="flex-wrap:wrap;gap:12px;">
          <div>
            <h2 class="card-title" style="display:flex;align-items:center;gap:8px;">
              <span aria-hidden="true">🌌</span> Codebase Galaxy
            </h2>
            <span style="font-size:0.75rem;color:var(--color-text-muted);">
              Interactive visual map of ${this.graph.nodes.length} files &amp; directories
              ${this.isTruncated ? ' &bull; <span class="badge badge-neutral" style="font-size:10px;">Top 150 active items</span>' : ''}
            </span>
          </div>

          <!-- Color Mode Toggle -->
          <div class="cg-mode-toggle" role="radiogroup" aria-label="Color mode">
            <button class="cg-mode-btn ${this.colorMode === 'type' ? 'active' : ''}" id="cg-mode-type">By File Type</button>
            <button class="cg-mode-btn ${this.colorMode === 'activity' ? 'active' : ''}" id="cg-mode-activity">By Change Frequency</button>
          </div>
        </div>

        <div class="cg-content-wrapper">
          <!-- Toolbar -->
          <div class="cg-toolbar">
            <div class="cg-search-box">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="cg-search-icon" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="cg-search-input" class="cg-search-input" placeholder="Search files or directories…" aria-label="Search files">
              <button class="cg-clear-btn hidden" id="cg-clear-search" aria-label="Clear search">✕</button>
            </div>

            <!-- Extension Filter Pills -->
            <div class="cg-filter-pills" id="cg-ext-pills" role="radiogroup" aria-label="File type filter">
              <button class="cg-pill ${this.selectedExtension === 'all' ? 'active' : ''}" data-ext="all">All</button>
              ${topExtensions.map(ext => `
                <button class="cg-pill ${this.selectedExtension === ext ? 'active' : ''}" data-ext="${safeEscape(ext)}">.${safeEscape(ext)}</button>
              `).join('')}
            </div>

            <!-- Canvas Controls -->
            <div class="cg-view-controls">
              <button class="cg-ctrl-btn" id="cg-btn-zoomin" title="Zoom In (+)" aria-label="Zoom in">+</button>
              <button class="cg-ctrl-btn" id="cg-btn-zoomout" title="Zoom Out (-)" aria-label="Zoom out">−</button>
              <button class="cg-ctrl-btn" id="cg-btn-reset" title="Reset View (R)" aria-label="Reset view">⛶</button>
            </div>
          </div>

          <!-- Canvas Stage -->
          <div class="cg-stage" id="cg-stage">
            <canvas id="cg-canvas" class="cg-canvas" tabindex="0" role="region" aria-label="Interactive Codebase Galaxy canvas. Use arrow keys to pan, plus and minus keys to zoom, and zero to reset."></canvas>

            <!-- Node Details Overlay Panel -->
            <div class="cg-inspector hidden" id="cg-inspector" role="region" aria-label="File inspector">
              <!-- Populated when node is clicked -->
            </div>

            <!-- Legends Overlay -->
            <div class="cg-legend" id="cg-legend" aria-label="Galaxy Legend">
              <!-- Dynamic based on colorMode -->
            </div>
          </div>

          <!-- Limitation Disclosure -->
          <div class="cg-notice">
            <span aria-hidden="true">ℹ️</span>
            <span>Visual map constructed from repository file tree and recent commit co-changes. Package-level import dependencies require manifest parsing.</span>
          </div>
        </div>
      `;

      this.updateLegend();
      this.initCanvas();
      this.attachEvents();
    }

    updateLegend() {
      const legend = this.container.querySelector('#cg-legend');
      if (!legend) return;

      if (this.colorMode === 'activity') {
        legend.innerHTML = `
          <div class="cg-legend-title">CHANGE FREQUENCY</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#f43f5e;"></span> Burning Red (10+ changes)</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#fb923c;"></span> Orange (5–9 changes)</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#38bdf8;"></span> Cyan (2–4 changes)</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#818cf8;"></span> Indigo (1 change)</div>
          <div class="cg-legend-item"><span class="cg-legend-line" style="border-bottom:1px solid rgba(124,92,252,0.4);"></span> Containment</div>
          <div class="cg-legend-item"><span class="cg-legend-line" style="border-bottom:2px dashed #22d3ee;"></span> Co-Changed</div>
        `;
      } else {
        legend.innerHTML = `
          <div class="cg-legend-title">FILE TYPES</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#7c5cfc;"></span> Directory</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#f7df1e;"></span> JS / TS / Web</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#3572A5;"></span> Python</div>
          <div class="cg-legend-item"><span class="cg-legend-dot" style="background:#22d3ee;"></span> Other Files</div>
          <div class="cg-legend-item"><span class="cg-legend-line" style="border-bottom:1px solid rgba(124,92,252,0.4);"></span> Directory Structure</div>
          <div class="cg-legend-item"><span class="cg-legend-line" style="border-bottom:2px dashed #22d3ee;"></span> Co-Changed in Commits</div>
        `;
      }
    }

    initCanvas() {
      const stage = this.container.querySelector('#cg-stage');
      this.canvas = this.container.querySelector('#cg-canvas');
      if (!stage || !this.canvas) return;

      this.ctx = this.canvas.getContext('2d');

      const resize = () => {
        const rect = stage.getBoundingClientRect();
        this.canvas.width = rect.width || 600;
        this.canvas.height = Math.max(380, rect.height || 420);
        if (this.panX === 0 && this.panY === 0) {
          this.panX = this.canvas.width / 2;
          this.panY = this.canvas.height / 2;
        }
        this.draw();
      };

      resize();
      window.addEventListener('resize', resize);
      this._boundListeners.push({ el: window, event: 'resize', handler: resize });

      // Generate static background stars
      this.starField = [];
      for (let i = 0; i < 60; i++) {
        this.starField.push({
          x: Math.random() * 1200 - 600,
          y: Math.random() * 1200 - 600,
          radius: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.7 + 0.2,
        });
      }

      this.resetView();
    }

    attachEvents() {
      if (!this.canvas) return;

      // Mouse Drag to Pan
      const onMouseDown = (e) => {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      };

      const onMouseMove = (e) => {
        if (this.isDragging) {
          this.panX = e.clientX - this.dragStartX;
          this.panY = e.clientY - this.dragStartY;
          this.draw();
        } else {
          // Hover check
          const rect = this.canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const worldX = (mouseX - this.panX) / this.zoom;
          const worldY = (mouseY - this.panY) / this.zoom;

          const hovered = this.findNodeAt(worldX, worldY);
          if (hovered !== this.hoveredNode) {
            this.hoveredNode = hovered;
            this.canvas.style.cursor = hovered ? 'pointer' : 'grab';
            this.draw();
          }
        }
      };

      const onMouseUp = () => {
        this.isDragging = false;
      };

      // Click to select node
      const onClick = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;

        const clicked = this.findNodeAt(worldX, worldY);
        this.selectNode(clicked);
      };

      // Wheel Zoom
      const onWheel = (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.setZoom(this.zoom * factor);
      };

      // Touch events for mobile support
      let initialTouchDist = null;
      let touchMoved = false;

      const onTouchStart = (e) => {
        if (e.touches.length === 1) {
          this.isDragging = true;
          this.dragStartX = e.touches[0].clientX - this.panX;
          this.dragStartY = e.touches[0].clientY - this.panY;
          touchMoved = false;
        } else if (e.touches.length === 2) {
          this.isDragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          initialTouchDist = Math.hypot(dx, dy);
        }
      };

      const onTouchMove = (e) => {
        if (e.touches.length === 1 && this.isDragging) {
          touchMoved = true;
          this.panX = e.touches[0].clientX - this.dragStartX;
          this.panY = e.touches[0].clientY - this.dragStartY;
          this.draw();
        } else if (e.touches.length === 2 && initialTouchDist) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          const factor = dist / initialTouchDist;
          this.setZoom(this.zoom * (factor > 1 ? 1.03 : 0.97));
          initialTouchDist = dist;
        }
      };

      const onTouchEnd = (e) => {
        if (!touchMoved && e.changedTouches && e.changedTouches.length === 1) {
          const rect = this.canvas.getBoundingClientRect();
          const touchX = e.changedTouches[0].clientX - rect.left;
          const touchY = e.changedTouches[0].clientY - rect.top;
          const worldX = (touchX - this.panX) / this.zoom;
          const worldY = (touchY - this.panY) / this.zoom;
          const tapped = this.findNodeAt(worldX, worldY);
          this.selectNode(tapped);
        }
        this.isDragging = false;
        initialTouchDist = null;
      };

      // Keyboard navigation
      const onKeyDown = (e) => {
        const step = 40;
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          this.setZoom(this.zoom * 1.2);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          this.setZoom(this.zoom * 0.8);
        } else if (e.key === '0' || e.key.toLowerCase() === 'r') {
          e.preventDefault();
          this.resetView();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.panY += step;
          this.draw();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.panY -= step;
          this.draw();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.panX += step;
          this.draw();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.panX -= step;
          this.draw();
        }
      };

      this.canvas.addEventListener('mousedown', onMouseDown);
      this.canvas.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      this.canvas.addEventListener('click', onClick);
      this.canvas.addEventListener('wheel', onWheel, { passive: false });
      this.canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      this.canvas.addEventListener('touchmove', onTouchMove, { passive: true });
      this.canvas.addEventListener('touchend', onTouchEnd);
      this.canvas.addEventListener('keydown', onKeyDown);

      this._boundListeners.push(
        { el: this.canvas, event: 'mousedown', handler: onMouseDown },
        { el: this.canvas, event: 'mousemove', handler: onMouseMove },
        { el: window, event: 'mouseup', handler: onMouseUp },
        { el: this.canvas, event: 'click', handler: onClick },
        { el: this.canvas, event: 'wheel', handler: onWheel },
        { el: this.canvas, event: 'touchstart', handler: onTouchStart },
        { el: this.canvas, event: 'touchmove', handler: onTouchMove },
        { el: this.canvas, event: 'touchend', handler: onTouchEnd },
        { el: this.canvas, event: 'keydown', handler: onKeyDown }
      );

      // Zoom Buttons
      const btnIn = this.container.querySelector('#cg-btn-zoomin');
      if (btnIn) {
        const handler = () => this.setZoom(this.zoom * 1.2);
        btnIn.addEventListener('click', handler);
        this._boundListeners.push({ el: btnIn, event: 'click', handler });
      }

      const btnOut = this.container.querySelector('#cg-btn-zoomout');
      if (btnOut) {
        const handler = () => this.setZoom(this.zoom * 0.8);
        btnOut.addEventListener('click', handler);
        this._boundListeners.push({ el: btnOut, event: 'click', handler });
      }

      const btnReset = this.container.querySelector('#cg-btn-reset');
      if (btnReset) {
        const handler = () => this.resetView();
        btnReset.addEventListener('click', handler);
        this._boundListeners.push({ el: btnReset, event: 'click', handler });
      }

      // Color Mode Buttons
      const btnType = this.container.querySelector('#cg-mode-type');
      const btnAct = this.container.querySelector('#cg-mode-activity');
      if (btnType && btnAct) {
        const handlerType = () => {
          btnType.classList.add('active');
          btnAct.classList.remove('active');
          this.setColorMode('type');
        };
        const handlerAct = () => {
          btnAct.classList.add('active');
          btnType.classList.remove('active');
          this.setColorMode('activity');
        };
        btnType.addEventListener('click', handlerType);
        btnAct.addEventListener('click', handlerAct);
        this._boundListeners.push(
          { el: btnType, event: 'click', handler: handlerType },
          { el: btnAct, event: 'click', handler: handlerAct }
        );
      }

      // Search input
      const searchInput = this.container.querySelector('#cg-search-input');
      const clearBtn = this.container.querySelector('#cg-clear-search');
      if (searchInput) {
        const onInput = (e) => {
          this.searchQuery = e.target.value;
          if (clearBtn) clearBtn.classList.toggle('hidden', !this.searchQuery);
          this.draw();
        };
        searchInput.addEventListener('input', onInput);
        this._boundListeners.push({ el: searchInput, event: 'input', handler: onInput });
      }

      if (clearBtn && searchInput) {
        const onClear = () => {
          searchInput.value = '';
          this.searchQuery = '';
          clearBtn.classList.add('hidden');
          this.draw();
        };
        clearBtn.addEventListener('click', onClear);
        this._boundListeners.push({ el: clearBtn, event: 'click', handler: onClear });
      }

      // Extension filter pills
      const extPills = this.container.querySelectorAll('.cg-pill');
      extPills.forEach(pill => {
        const onClick = () => {
          extPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          this.selectedExtension = pill.getAttribute('data-ext') || 'all';
          this.draw();
        };
        pill.addEventListener('click', onClick);
        this._boundListeners.push({ el: pill, event: 'click', handler: onClick });
      });
    }

    findNodeAt(worldX, worldY) {
      if (!this.graph || !this.graph.nodes) return null;
      for (let i = this.graph.nodes.length - 1; i >= 0; i--) {
        const node = this.graph.nodes[i];
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        const distSq = dx * dx + dy * dy;
        const hitRadius = Math.max(12, node.radius);
        if (distSq <= hitRadius * hitRadius) {
          return node;
        }
      }
      return null;
    }

    selectNode(node) {
      this.selectedNode = node;
      this.renderInspector();
      this.draw();
    }

    renderInspector() {
      const panel = this.container.querySelector('#cg-inspector');
      if (!panel) return;

      if (!this.selectedNode) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
      }

      const node = this.selectedNode;
      panel.classList.remove('hidden');

      const isDir = node.type === 'directory';
      const typeBadge = isDir ? 'Directory' : (node.extension ? `.${node.extension.toUpperCase()}` : 'File');
      const ghLink = node.githubUrl || (this.owner && this.repo
        ? `https://github.com/${this.owner}/${this.repo}/blob/main/${node.path}`
        : null);

      // Find supported relationships connected to this node
      const connectedEdges = (this.graph.edges || []).filter(e => e.source === node.id || e.target === node.id);
      const coChangeEdges = connectedEdges.filter(e => e.type === 'co-change');

      panel.innerHTML = `
        <div class="cg-inspector-header">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="cg-node-indicator" style="background:${node.color};"></span>
            <span class="cg-inspector-title" title="${safeEscape(node.path)}">${safeEscape(node.name)}</span>
          </div>
          <button class="cg-close-btn" id="cg-close-inspector" aria-label="Close inspector">✕</button>
        </div>

        <div class="cg-inspector-body">
          <div class="cg-meta-row">
            <span class="cg-meta-label">Path:</span>
            <span class="cg-meta-value"><code title="${safeEscape(node.path)}">${safeEscape(node.path)}</code></span>
          </div>
          <div class="cg-meta-row">
            <span class="cg-meta-label">Type:</span>
            <span class="badge badge-neutral">${safeEscape(typeBadge)}</span>
          </div>
          ${!isDir ? `
            <div class="cg-meta-row">
              <span class="cg-meta-label">Activity:</span>
              <span class="cg-meta-value" style="color:var(--color-cyan);font-weight:600;">
                ${node.changeCount > 0 ? `${node.changeCount} recent changes` : 'Standard activity'}
              </span>
            </div>
          ` : `
            <div class="cg-meta-row">
              <span class="cg-meta-label">Structure:</span>
              <span class="cg-meta-value">${connectedEdges.length} connected files</span>
            </div>
          `}

          ${coChangeEdges.length > 0 ? `
            <div class="cg-meta-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin-top:4px;">
              <span class="cg-meta-label">Co-changed with:</span>
              <div style="display:flex;flex-wrap:wrap;gap:4px;">
                ${coChangeEdges.slice(0, 3).map(e => {
                  const otherId = e.source === node.id ? e.target : e.source;
                  const otherName = otherId.split('/').pop();
                  return `<span class="badge badge-accent" style="font-size:9px;" title="${safeEscape(otherId)}">${safeEscape(otherName)}</span>`;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${ghLink && !isDir ? `
            <div style="margin-top:12px;">
              <a href="${safeEscape(ghLink)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm" style="width:100%;text-align:center;">
                View File on GitHub ↗
              </a>
            </div>
          ` : ''}
        </div>
      `;

      const closeBtn = panel.querySelector('#cg-close-inspector');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.selectedNode = null;
          this.renderInspector();
          this.draw();
        });
      }
    }

    // ── Drawing Engine ───────────────────────────────────────────────────────

    draw() {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const width = this.canvas.width;
      const height = this.canvas.height;

      // Filter matches
      const { matchingNodeIds } = filterGalaxyGraph(this.graph, this.searchQuery, this.selectedExtension);
      const isFiltered = this.searchQuery.trim().length > 0 || this.selectedExtension !== 'all';

      // 1. Clear background & space depth
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, width, height);

      // Subtle radial cosmic glow in center
      const gradient = ctx.createRadialGradient(this.panX, this.panY, 10, this.panX, this.panY, 350 * this.zoom);
      gradient.addColorStop(0, 'rgba(124, 92, 252, 0.12)');
      gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.05)');
      gradient.addColorStop(1, 'rgba(10, 14, 26, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Starfield
      ctx.save();
      ctx.translate(this.panX, this.panY);
      ctx.scale(this.zoom, this.zoom);

      ctx.fillStyle = '#ffffff';
      this.starField.forEach(star => {
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Map node lookups
      const nodesMap = new Map();
      this.graph.nodes.forEach(n => nodesMap.set(n.id, n));

      // 3. Draw Edges
      this.graph.edges.forEach(edge => {
        const source = nodesMap.get(edge.source);
        const target = nodesMap.get(edge.target);
        if (!source || !target) return;

        const isCoChange = edge.type === 'co-change';
        const isConnectedToSelected = this.selectedNode && (source.id === this.selectedNode.id || target.id === this.selectedNode.id);

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (isCoChange) {
          ctx.strokeStyle = isConnectedToSelected ? '#22d3ee' : 'rgba(34, 211, 238, 0.4)';
          ctx.lineWidth = isConnectedToSelected ? 2.5 : 1.5;
          ctx.setLineDash([4, 4]);
        } else {
          ctx.strokeStyle = isConnectedToSelected ? '#9b7dff' : 'rgba(124, 92, 252, 0.18)';
          ctx.lineWidth = isConnectedToSelected ? 2 : 1;
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 4. Draw Nodes
      this.graph.nodes.forEach(node => {
        const isMatched = !isFiltered || matchingNodeIds.has(node.id);
        const isSelected = this.selectedNode && this.selectedNode.id === node.id;
        const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;

        const alpha = isMatched ? 1.0 : 0.2;
        ctx.globalAlpha = alpha;

        // Outer glow on selection or hover
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(34, 211, 238, 0.35)' : 'rgba(124, 92, 252, 0.25)';
          ctx.fill();
        }

        // Main Node Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.stroke();

        // Node Label (for directories or when zoomed in or when selected)
        if (this.zoom >= 0.7 || node.type === 'directory' || isSelected || isHovered) {
          ctx.fillStyle = isSelected ? '#ffffff' : (node.type === 'directory' ? '#e8ecf4' : '#8892a8');
          ctx.font = isSelected ? 'bold 11px Inter, sans-serif' : '10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + node.radius + 12);
        }
      });

      ctx.restore();
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    CodebaseGalaxyComponent,
    createGalaxyNode,
    createGalaxyEdge,
    buildGalaxyGraphFromData,
    filterGalaxyGraph,
    getNodeColor,
    EXTENSION_COLORS,
  };
});
