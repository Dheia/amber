/*
 * DragScroll
 *
 * Allows to scroll an element content in the horizontal or vertical directions. This script
 * doesn't use absolute positioning and relies on the scrollLeft/scrollTop DHTML properties.
 * The element width should be fixed with the CSS or JavaScript.
 *
 * Events dispatched on the element:
 * - drag-scroll:start
 * - drag-scroll:drag
 * - drag-scroll:stop
 *
 * Options:
 * - start - callback function to execute when the drag starts
 * - drag - callback function to execute when the element is dragged
 * - stop - callback function to execute when the drag ends
 * - vertical - determines if the scroll direction is vertical, false by default
 * - scrollClassContainer - if specified, an element or element selector to apply the
 *   'scroll-before' and 'scroll-after' CSS classes, depending on whether the scrollable area is
 *   in its start or end
 * - scrollMarkerContainer - if specified, an element or element selector to inject scroll
 *   markers (span elements indicating whether scrolling is possible)
 * - useDrag - determines if dragging is allowed, true by default
 * - useNative - if native CSS is enabled via "mobile" on the HTML tag, false by default
 * - useScroll - determines if mouse wheel scrolling is allowed, true by default
 * - useComboScroll - determines if horizontal scroll should act as vertical, and vice versa, true by default
 * - dragSelector - restrict drag events to this selector
 * - scrollSelector - restrict scroll events to this selector
 *
 * Methods:
 * - dispose - clean up the instance
 * - isStart - determines if the scrollable area is in its start (left or top)
 * - isEnd - determines if the scrollable area is in its end (right or bottom)
 * - goToStart - moves the scrollable area to the start (left or top)
 * - goToElement - moves the scrollable area to an element
 * - pause - pauses drag and scroll
 * - resume - resumes drag and scroll
 */
'use strict';

export default class DragScroll {
    static DEFAULTS = {
        vertical: false,
        useDrag: true,
        useScroll: true,
        useNative: false,
        useComboScroll: true,
        scrollClassContainer: false,
        scrollMarkerContainer: false,
        scrollSelector: null,
        dragSelector: null,
        noScrollClasses: false,
        noOverScroll: false,
        dragClass: 'drag',
        start: function() {},
        drag: function() {},
        stop: function() {}
    };

    constructor(element, options) {
        this.options = Object.assign({}, DragScroll.DEFAULTS, options || {});

        this.el = element;
        this.scrollClassContainer = this.resolveElement(this.options.scrollClassContainer) || element;
        this.isScrollable = true;
        this.dragStart = 0;
        this.startOffset = 0;
        this.dragging = false;
        this.paused = false;
        this.touchDragStarted = false;
        this.eventCoordName = this.options.vertical ? 'pageY' : 'pageX';
        this.isNative = this.options.useNative && document.documentElement.classList.contains('mobile');
        this.fixScrollClassesIntervalId = null;
        this.wheelUpdateTimer = null;
        this.markers = [];
        this.listeners = [];

        // Inject scroll markers
        if (this.options.scrollMarkerContainer) {
            const markerContainer = this.resolveElement(this.options.scrollMarkerContainer);
            if (markerContainer) {
                ['before', 'after'].forEach((position) => {
                    const marker = document.createElement('span');
                    marker.className = position + ' scroll-marker';
                    markerContainer.appendChild(marker);
                    this.markers.push(marker);
                });
            }
        }

        // Bind events
        this.scrollTarget = this.options.scrollSelector
            ? element.querySelector(this.options.scrollSelector) || element
            : element;

        this.onWheel = this.onWheel.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onClickCapture = this.onClickCapture.bind(this);
        this.fixScrollClasses = this.fixScrollClasses.bind(this);
        this.onScroll = () => this.fixScrollClasses();
        this.onResize = () => this.fixScrollClasses();

        this.listen(this.scrollTarget, 'wheel', this.onWheel);

        if (this.options.useDrag) {
            this.listen(element, 'mousedown', this.onMouseDown);
        }

        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            this.listen(element, 'touchstart', this.onTouchStart);
        }

        // Suppress item clicks while dragging
        this.listen(element, 'click', this.onClickCapture, true);

        if (!this.options.noScrollClasses) {
            this.listen(window, 'resize', this.onResize);
            this.listen(element, 'scroll', this.onScroll);
        }

        this.fixScrollClasses();
    }

    dispose() {
        clearTimeout(this.fixScrollClassesIntervalId);
        clearTimeout(this.wheelUpdateTimer);

        this.stopWindowListeners();

        this.listeners.forEach(([target, type, handler, opts]) => {
            target.removeEventListener(type, handler, opts);
        });
        this.listeners = [];

        this.markers.forEach((marker) => marker.remove());
        this.markers = [];

        this.scrollClassContainer = null;
        this.scrollTarget = null;
        this.el = null;
    }

    // Internal

    listen(target, type, handler, opts) {
        target.addEventListener(type, handler, opts);
        this.listeners.push([target, type, handler, opts]);
    }

    resolveElement(value) {
        if (!value) {
            return null;
        }
        return typeof value === 'string' ? document.querySelector(value) : value;
    }

    matchesDragSelector(target) {
        if (!this.options.dragSelector) {
            return true;
        }
        return !!target.closest(this.options.dragSelector);
    }

    dispatch(name) {
        this.el.dispatchEvent(new CustomEvent(name, { bubbles: true }));
    }

    getWheelDelta(delta, event) {
        const deltaFactor = event.deltaMode === 1 ? 40 : (event.deltaMode === 2 ? this.el.clientHeight : 1);

        return -(delta || 0) * deltaFactor;
    }

    onWheel(event) {
        if (!this.options.useScroll || this.paused) {
            return;
        }

        const offsetX = this.getWheelDelta(event.deltaX, event),
            offsetY = this.getWheelDelta(event.deltaY, event);

        let offset;
        if (!offsetX && this.options.useComboScroll) {
            offset = offsetY * -1;
        }
        else if (!offsetY && this.options.useComboScroll) {
            offset = offsetX;
        }
        else {
            offset = this.options.vertical ? offsetY * -1 : offsetX;
        }

        const scrolled = this.scrollWheel(offset);
        if (scrolled) {
            event.preventDefault();
            event.stopPropagation();
        }
        else if (this.options.noOverScroll) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    onMouseDown(event) {
        if (this.paused || !this.isScrollable) {
            return;
        }

        // Don't prevent clicking inputs in the toolbar
        if (event.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) {
            return;
        }

        if (!this.matchesDragSelector(event.target)) {
            return;
        }

        this.startDrag(event);
        event.preventDefault();
    }

    onTouchStart(event) {
        if (this.paused) {
            return;
        }

        if (!this.matchesDragSelector(event.target)) {
            return;
        }

        if (event.touches.length === 1) {
            this.startDrag(event.touches[0]);
            this.touchDragStarted = true;

            // Listen only while dragging since a non-passive window listener delays page scrolling
            window.addEventListener('touchmove', this.onTouchMove, { passive: false });

            event.stopPropagation();
        }
    }

    onClickCapture(event) {
        // Do not handle item clicks while dragging
        if (document.body.classList.contains(this.options.dragClass)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }

    startDrag(pointer) {
        this.dragStart = pointer[this.eventCoordName];
        this.startOffset = this.options.vertical ? this.el.scrollTop : this.el.scrollLeft;
        this.dragStartPageX = pointer.pageX;
        this.dragStartPageY = pointer.pageY;

        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            window.addEventListener('touchend', this.onTouchEnd);
            window.addEventListener('touchcancel', this.onTouchEnd);
        }

        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);
    }

    onMouseMove(event) {
        this.moveDrag(event);
        event.preventDefault();
    }

    onMouseUp(event) {
        const isClick = this.dragStartPageX === event.pageX && this.dragStartPageY === event.pageY;
        this.stopDrag(isClick);
        event.preventDefault();
    }

    onTouchMove(event) {
        if (!this.touchDragStarted) {
            return;
        }

        this.moveDrag(event.touches[0]);
        if (!this.isNative) {
            event.preventDefault();
        }
    }

    onTouchEnd() {
        this.stopDrag();
    }

    moveDrag(pointer) {
        const current = pointer[this.eventCoordName],
            offset = this.dragStart - current;

        if (Math.abs(offset) > 3) {
            if (!this.dragging) {
                this.dragging = true;
                this.dispatch('drag-scroll:start');
                this.options.start();
                document.body.classList.add(this.options.dragClass);
            }

            if (!this.isNative) {
                if (this.options.vertical) {
                    this.el.scrollTop = this.startOffset + offset;
                }
                else {
                    this.el.scrollLeft = this.startOffset + offset;
                }
            }

            this.fixScrollClasses(true);

            this.dispatch('drag-scroll:drag');
            this.options.drag();
        }
    }

    stopWindowListeners() {
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('touchcancel', this.onTouchEnd);
        window.removeEventListener('touchmove', this.onTouchMove, { passive: false });
    }

    stopDrag(click) {
        this.stopWindowListeners();
        this.touchDragStarted = false;
        this.dragging = false;

        if (click) {
            document.body.classList.remove(this.options.dragClass);
        }
        else {
            this.fixScrollClasses();
        }

        window.setTimeout(() => {
            if (!click) {
                document.body.classList.remove(this.options.dragClass);
                this.dispatch('drag-scroll:stop');
                this.options.stop();
                this.fixScrollClasses();
            }
        }, 100);
    }

    scrollWheel(offset) {
        if (this.paused) {
            return false;
        }

        const el = this.el;

        this.startOffset = this.options.vertical ? el.scrollTop : el.scrollLeft;

        if (this.options.vertical) {
            el.scrollTop = this.startOffset + offset;
        }
        else {
            el.scrollLeft = this.startOffset + offset;
        }

        const scrolled = this.options.vertical
            ? el.scrollTop !== this.startOffset
            : el.scrollLeft !== this.startOffset;

        this.dispatch('drag-scroll:drag');
        this.options.drag();

        if (scrolled) {
            clearTimeout(this.wheelUpdateTimer);
            this.wheelUpdateTimer = window.setTimeout(() => {
                this.wheelUpdateTimer = null;
                this.fixScrollClasses();
            }, 100);
        }

        return scrolled;
    }

    // Public

    fixScrollClasses(isThrottle) {
        if (this.options.noScrollClasses) {
            return;
        }

        if (this.fixScrollClassesIntervalId) {
            if (isThrottle) {
                return;
            }

            clearTimeout(this.fixScrollClassesIntervalId);
            this.fixScrollClassesIntervalId = null;
        }

        this.fixScrollClassesIntervalId = window.setTimeout(() => {
            this.fixScrollClassesIntervalId = null;

            if (!this.el || !this.scrollClassContainer) {
                return;
            }

            const isStart = this.isStart(),
                isEnd = this.isEnd();

            this.scrollClassContainer.classList.toggle('scroll-before', !isStart);
            this.scrollClassContainer.classList.toggle('scroll-after', !isEnd);

            this.scrollClassContainer.classList.toggle('scroll-active-before', this.isActiveBefore());
            this.scrollClassContainer.classList.toggle('scroll-active-after', this.isActiveAfter());
            this.isScrollable = !isStart || !isEnd;
        }, 30);
    }

    isStart() {
        if (!this.options.vertical) {
            return this.el.scrollLeft <= 0;
        }
        return this.el.scrollTop <= 0;
    }

    isEnd() {
        // Fudge factor for retina displays
        const offset = 1;

        if (!this.options.vertical) {
            return this.el.scrollWidth - (this.el.scrollLeft + this.el.offsetWidth) - offset <= 0;
        }
        return this.el.scrollHeight - (this.el.scrollTop + this.el.offsetHeight) - offset <= 0;
    }

    goToStart() {
        if (!this.options.vertical) {
            this.el.scrollLeft = 0;
        }
        else {
            this.el.scrollTop = 0;
        }
    }

    /*
     * Determines if the element with the class 'active' is hidden after the viewport -
     * on the right or on the bottom.
     */
    isActiveAfter() {
        const activeElement = this.el.querySelector('.active');
        if (!activeElement) {
            return false;
        }

        if (!this.options.vertical) {
            return activeElement.offsetLeft > this.el.scrollLeft + this.el.clientWidth;
        }
        return activeElement.offsetTop > this.el.scrollTop + this.el.clientHeight;
    }

    /*
     * Determines if the element with the class 'active' is hidden before the viewport -
     * on the left or on the top.
     */
    isActiveBefore() {
        const activeElement = this.el.querySelector('.active');
        if (!activeElement) {
            return false;
        }

        if (!this.options.vertical) {
            return activeElement.offsetLeft + activeElement.offsetWidth < this.el.scrollLeft;
        }
        return activeElement.offsetTop + activeElement.offsetHeight < this.el.scrollTop;
    }

    goToElement(element, callback, options) {
        const target = this.resolveElement(element);
        if (!target) {
            return;
        }

        const params = Object.assign({
            duration: 300,
            alignBottom: false
        }, options || {});

        let destination = null;

        if (!this.options.vertical) {
            if (target.offsetLeft - this.el.scrollLeft < 0) {
                destination = { scrollLeft: target.offsetLeft };
            }
            else if (target.offsetLeft + target.offsetWidth - (this.el.scrollLeft + this.el.clientWidth) > 0) {
                destination = { scrollLeft: target.offsetLeft + target.offsetWidth - this.el.clientWidth };
            }
        }
        else {
            const heightOffset = params.alignBottom ? target.offsetHeight : 0;

            if (target.offsetTop - this.el.scrollTop < 0) {
                destination = { scrollTop: target.offsetTop };
            }
            else if (target.offsetTop + heightOffset - (this.el.scrollTop + this.el.clientHeight) > 0) {
                destination = { scrollTop: target.offsetTop + target.offsetHeight - this.el.clientHeight + heightOffset };
            }
        }

        if (!destination) {
            if (callback !== undefined) {
                callback();
            }
            return;
        }

        this.animateScroll(destination, params.duration, () => {
            this.fixScrollClasses();
            if (callback !== undefined) {
                callback();
            }
        });
    }

    animateScroll(destination, duration, complete) {
        const el = this.el,
            prop = destination.scrollLeft !== undefined ? 'scrollLeft' : 'scrollTop',
            from = el[prop],
            to = destination[prop],
            startTime = performance.now();

        const step = (now) => {
            const progress = Math.min((now - startTime) / duration, 1),
                eased = 1 - Math.pow(1 - progress, 3);

            el[prop] = from + (to - from) * eased;

            if (progress < 1) {
                requestAnimationFrame(step);
            }
            else {
                complete();
            }
        };

        requestAnimationFrame(step);
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
    }
}
