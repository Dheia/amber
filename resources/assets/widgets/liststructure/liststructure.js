/*
 * List structure widget control
 *
 * Data attributes:
 * - data-control="liststructurewidget" - enables the control
 * - data-reorder-handler - AJAX handler for reorder postbacks
 * - data-toggle-handler - AJAX handler for tree node toggling
 * - data-use-reorder / data-use-tree / data-drag-row
 * - data-include-sort-orders - include sort_orders in the postback
 * - data-indent-size - pixels per tree level
 * - data-max-depth - maximum nesting depth
 *
 * Tree node toggling posts through plain data-request attributes; this
 * control implements the drag reorder interaction with pointer events.
 */
'use strict';

export function registerListStructureWidget(jax) {
    jax.registerControl('liststructurewidget', class extends jax.ControlBase {
        init() {
            this.config = Object.assign({
                reorderHandler: null,
                toggleHandler: null,
                useReorder: false,
                useTree: false,
                dragRow: true,
                includeSortOrders: false,
                indentSize: 18,
                maxDepth: null
            }, this.config);

            this.drag = null;
            this.onPointerMove = this.onPointerMove.bind(this);
            this.onPointerUp = this.onPointerUp.bind(this);
        }

        connect() {
            this.body = this.element.querySelector('tbody');

            if (this.config.useReorder) {
                this.listen('pointerdown', this.onPointerDown);
                this.listen('click', this.onClickCapture);
            }
        }

        disconnect() {
            removeEventListener('pointermove', this.onPointerMove);
            removeEventListener('pointerup', this.onPointerUp);
            this.body = null;
            this.drag = null;
        }

        //
        // Drag lifecycle
        //

        onPointerDown(ev) {
            if (ev.button !== 0) {
                return;
            }

            const handle = ev.target.closest('.list-reorder-handle');
            let row = null;

            if (handle) {
                row = handle.closest('tr[data-tree-id]');
            }
            else if (this.toBool(this.config.dragRow)) {
                // Avoid starting a drag from interactive elements
                if (ev.target.closest('a, input, select, button, label')) {
                    return;
                }
                row = ev.target.closest('tr[data-tree-id]');
            }

            if (!row || !this.body.contains(row)) {
                return;
            }

            this.drag = {
                row: row,
                started: false,
                startX: ev.clientX,
                startY: ev.clientY,
                level: parseInt(row.dataset.treeLevel) || 0,
                proposedLevel: parseInt(row.dataset.treeLevel) || 0,
                children: [],
                suppressClick: false
            };

            addEventListener('pointermove', this.onPointerMove);
            addEventListener('pointerup', this.onPointerUp);

            ev.preventDefault();
        }

        onPointerMove(ev) {
            const drag = this.drag;
            if (!drag) {
                return;
            }

            // Require a small threshold before entering drag mode, so clicks
            // and row links keep working
            if (!drag.started) {
                if (Math.abs(ev.clientX - drag.startX) < 4 && Math.abs(ev.clientY - drag.startY) < 4) {
                    return;
                }
                this.startDrag();
            }

            // Vertical: move the row through its siblings
            const target = this.rowFromPoint(ev.clientY);
            if (target && target !== drag.row) {
                const rect = target.getBoundingClientRect();
                if (ev.clientY < rect.top + rect.height / 2) {
                    target.before(drag.row);
                }
                else {
                    target.after(drag.row);
                }
            }

            // Horizontal: propose a new tree level
            if (this.toBool(this.config.useTree)) {
                const offsetLevels = Math.round((ev.clientX - drag.startX) / this.config.indentSize);
                drag.proposedLevel = this.clampLevel(drag.level + offsetLevels);
            }

            drag.suppressClick = true;
        }

        onPointerUp() {
            removeEventListener('pointermove', this.onPointerMove);
            removeEventListener('pointerup', this.onPointerUp);

            const drag = this.drag;
            if (!drag || !drag.started) {
                this.drag = null;
                return;
            }

            const row = drag.row;
            const proposedLevel = this.clampLevel(drag.proposedLevel);

            row.classList.remove('sortable-chosen');
            this.body.classList.remove('tree-drag-mode');

            row.dataset.treeLevel = proposedLevel;

            // Bring hidden children along, adjusting their levels
            const levelDistance = drag.level - proposedLevel;
            let anchor = row;
            drag.children.forEach((child) => {
                child.style.display = '';
                child.dataset.treeLevel = (parseInt(child.dataset.treeLevel) || 0) - levelDistance;
                anchor.after(child);
                anchor = child;
            });

            // Post back data to server; the response re-renders the list
            const postData = this.getMovePostData(row, proposedLevel);

            if (this.toBool(this.config.includeSortOrders)) {
                postData.sort_orders = this.getRecordSortData();
            }

            jax.request(this.element, this.config.reorderHandler, {
                data: postData
            });

            // Keep click suppression until after the click event fires
            const self = this;
            setTimeout(function() { self.drag = null; }, 0);
        }

        onClickCapture(ev) {
            if (this.drag && this.drag.suppressClick) {
                ev.stopPropagation();
                ev.preventDefault();
            }
        }

        startDrag() {
            const drag = this.drag;
            drag.started = true;

            // Collect and hide the visible children of the dragged row
            let next = drag.row.nextElementSibling;
            while (next && (parseInt(next.dataset.treeLevel) || 0) > drag.level) {
                drag.children.push(next);
                next = next.nextElementSibling;
            }
            drag.children.forEach((child) => {
                child.style.display = 'none';
            });

            drag.row.classList.add('sortable-chosen');
            this.body.classList.add('tree-drag-mode');
        }

        //
        // Helpers
        //

        rowFromPoint(clientY) {
            const rows = this.body.querySelectorAll('tr[data-tree-id]');
            for (const row of rows) {
                if (row === this.drag.row || row.style.display === 'none') {
                    continue;
                }
                const rect = row.getBoundingClientRect();
                if (clientY >= rect.top && clientY <= rect.bottom) {
                    return row;
                }
            }
            return null;
        }

        clampLevel(level) {
            const drag = this.drag,
                row = drag.row;

            if (!this.toBool(this.config.useTree)) {
                return 0;
            }

            // The previous visible row constrains the deepest allowed level;
            // the next row constrains the shallowest
            const prev = this.visibleSibling(row, 'previous'),
                next = this.visibleSibling(row, 'next');

            let max = prev ? (parseInt(prev.dataset.treeLevel) || 0) + 1 : 0;
            let min = next ? (parseInt(next.dataset.treeLevel) || 0) : 0;

            if (this.config.maxDepth !== null) {
                max = Math.min(max, this.config.maxDepth - 1);
            }

            return Math.max(min, Math.min(max, level));
        }

        visibleSibling(row, direction) {
            let el = direction === 'previous' ? row.previousElementSibling : row.nextElementSibling;
            while (el && (el.style.display === 'none' || !el.dataset.treeId)) {
                el = direction === 'previous' ? el.previousElementSibling : el.nextElementSibling;
            }
            return el;
        }

        getMovePostData(row, proposedLevel) {
            const data = {
                record_id: row.dataset.treeId
            };

            // Find next sibling at the proposed level
            let next = row.nextElementSibling;
            while (next) {
                const level = parseInt(next.dataset.treeLevel) || 0;
                if (level === proposedLevel) {
                    data.next_id = next.dataset.treeId;
                    break;
                }
                if (level < proposedLevel) {
                    break;
                }
                next = next.nextElementSibling;
            }

            // Find previous sibling at the proposed level
            let prev = row.previousElementSibling;
            while (prev) {
                const level = parseInt(prev.dataset.treeLevel) || 0;
                if (level === proposedLevel) {
                    data.previous_id = prev.dataset.treeId;
                    break;
                }
                if (level < proposedLevel) {
                    break;
                }
                prev = prev.previousElementSibling;
            }

            // Find parent row
            prev = row.previousElementSibling;
            while (prev) {
                const level = parseInt(prev.dataset.treeLevel) || 0;
                if (level < proposedLevel) {
                    data.parent_id = prev.dataset.treeId;
                    break;
                }
                prev = prev.previousElementSibling;
            }

            return data;
        }

        getRecordSortData() {
            return [...this.body.querySelectorAll('tr[data-tree-id]')]
                .map((row) => row.dataset.treeId);
        }

        toBool(value) {
            return value === true || value === 'true' || value === '1' || value === 1;
        }
    });
}
