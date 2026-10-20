import { afterEach, beforeAll, describe, expect, setSystemTime, test } from 'bun:test';
import { registerDatepicker } from '../resources/assets/controls/datepicker/datepicker.js';

function parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value !== '' && !isNaN(Number(value))) return Number(value);
    if (value.charAt(0) === '[') return JSON.parse(value);
    return value;
}

function makeFakeJax() {
    class ControlBase {
        constructor(element) {
            this.element = element;
            this.config = {};

            for (const attr of element.attributes) {
                if (attr.name.startsWith('data-')) {
                    const key = attr.name.slice(5).replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
                    this.config[key] = parseValue(attr.value);
                }
            }
        }

        // Supports listen(event, handler) and the delegated listen(event, selector, handler)
        listen(eventName, selectorOrHandler, handler) {
            if (typeof selectorOrHandler === 'string') {
                this.element.addEventListener(eventName, (ev) => {
                    if (ev.target.closest(selectorOrHandler)) {
                        handler.call(this, ev);
                    }
                });
            }
            else {
                this.element.addEventListener(eventName, selectorOrHandler.bind(this));
            }
        }
    }

    return {
        controls: new Map(),
        ControlBase,
        registerControl(id, control) {
            this.controls.set(id, control);
        }
    };
}

let jax;

beforeAll(() => {
    jax = makeFakeJax();
    registerDatepicker(jax);
});

afterEach(() => {
    document.body.innerHTML = '';
});

function connectPicker({ attributes = '', value = '', date = true, time = true, dateAttributes = '' } = {}) {
    document.body.innerHTML = `<div data-control="datepicker" ${attributes}>${date ? `<input type="text" data-datepicker ${dateAttributes} />` : ''}${time ? '<input type="text" data-timepicker />' : ''}<input type="hidden" name="when" value="${value}" data-datetime-value /></div>`;

    const element = document.querySelector('[data-control="datepicker"]');
    const control = new (jax.controls.get('datepicker'))(element);
    control.init();
    control.connect();

    return {
        control,
        element,
        dateFacade: element.querySelector('[data-datepicker]'),
        timeFacade: element.querySelector('[data-timepicker]'),
        locker: element.querySelector('[data-datetime-value]')
    };
}

function change(input, value) {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('datepicker formatting', () => {
    test('formats and parses the supported date tokens', () => {
        const { control } = connectPicker();
        const date = new Date(2026, 9, 1);

        expect(control.formatDate(date, 'DD/MM/YYYY')).toBe('01/10/2026');
        expect(control.formatDate(date, 'dddd, Do MMMM YY')).toBe('Thursday, 1st October 26');
        expect(control.formatDate(date, '[Day] D [of] MMM')).toBe('Day 1 of Oct');

        expect(control.parseFormattedDate('01/10/2026', 'DD/MM/YYYY')).toEqual(date);
        expect(control.parseFormattedDate('Thursday, 1st October 26', 'dddd, Do MMMM YY')).toEqual(date);
        expect(control.parseFormattedDate('31/02/2026', 'DD/MM/YYYY')).toBeNull();
        expect(control.parseFormattedDate('2026-10-01', 'DD/MM/YYYY')).toBeNull();
    });

    test('loads a stored date and time into the facades using the display format', () => {
        const { dateFacade, timeFacade } = connectPicker({
            attributes: 'data-format="DD MMM YYYY"',
            value: '2026-10-20 14:30:00'
        });

        expect(dateFacade.value).toBe('20 Oct 2026');
        expect(timeFacade.value).toBe('14:30');
    });

    test('a time-only picker reads the time from a full stored date and time', () => {
        const { timeFacade } = connectPicker({ date: false, value: '2026-10-20 14:30:00' });

        expect(timeFacade.value).toBe('14:30');
    });

    test('hours only in twelve hour mode shows and stores the hour', () => {
        const { timeFacade, locker } = connectPicker({
            date: false,
            attributes: 'data-hours-only="1" data-twelve-hour="1"',
            value: '14:00:00'
        });

        expect(timeFacade.value).toBe('02 PM');

        change(timeFacade, '09 AM');
        expect(locker.value).toBe('09:00:00');
    });
});

describe('datepicker locker', () => {
    test('picking only a date fills midnight when configured', () => {
        const { dateFacade, locker } = connectPicker({ attributes: 'data-default-time-midnight="1"' });

        change(dateFacade, '2026-10-21');

        expect(locker.value).toBe('2026-10-21 00:00:00');
    });

    test('picking only a time fills today as the date', () => {
        const { control, timeFacade, locker } = connectPicker();

        change(timeFacade, '09:15');

        expect(locker.value).toBe(control.formatDate(new Date(), 'YYYY-MM-DD') + ' 09:15:00');
    });

    test('clearing either facade empties the whole value', () => {
        const { dateFacade, timeFacade, locker } = connectPicker({ value: '2026-10-20 14:30:00' });

        change(timeFacade, '');

        expect(locker.value).toBe('');
        expect(dateFacade.value).toBe('');
    });

    test('a date-only picker stores just the date', () => {
        const { dateFacade, locker } = connectPicker({ time: false, attributes: 'data-format="DD/MM/YYYY"' });

        change(dateFacade, '05/11/2026');

        expect(locker.value).toBe('2026-11-05');
    });
});

describe('datepicker options', () => {
    test('disableDays blocks weekdays and explicit dates', () => {
        const { control } = connectPicker({ attributes: `data-disable-days='[0,"2026-10-21"]'` });

        expect(control.isDateDisabled(new Date(2026, 9, 18))).toBe(true);
        expect(control.isDateDisabled(new Date(2026, 9, 21))).toBe(true);
        expect(control.isDateDisabled(new Date(2026, 9, 22))).toBe(false);
    });

    test('a readonly facade is not bound until a trigger enables it', () => {
        const { control, dateFacade, element } = connectPicker({ time: false, dateAttributes: 'readonly' });

        expect(control.picker).toBeNull();

        dateFacade.removeAttribute('readonly');
        element.dispatchEvent(new CustomEvent('trigger:disable', { bubbles: true }));
        expect(control.picker).not.toBeNull();

        dateFacade.disabled = true;
        element.dispatchEvent(new CustomEvent('trigger:disable', { bubbles: true }));
        expect(control.picker).toBeNull();
    });
});

describe('datepicker timezone', () => {
    afterEach(() => {
        setSystemTime();
    });

    test('fills the current date and time from the configured timezone clock', () => {
        setSystemTime(new Date('2026-10-20T14:30:15Z'));

        const first = connectPicker({ attributes: 'data-timezone="Australia/Sydney"' });
        change(first.timeFacade, '09:15');
        expect(first.locker.value).toBe('2026-10-21 09:15:00');

        const second = connectPicker({ attributes: 'data-timezone="America/New_York"' });
        change(second.dateFacade, '2026-10-22');
        expect(second.locker.value).toBe('2026-10-22 10:30:15');
    });

    test('an unknown timezone falls back to the browser clock', () => {
        const { control } = connectPicker({ attributes: 'data-timezone="Mars/Olympus"' });

        expect(control.getNow().date).toBe(control.formatDate(new Date(), 'YYYY-MM-DD'));
    });
});
