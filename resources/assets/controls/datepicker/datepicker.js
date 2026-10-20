/*
 * DatePicker control
 *
 * A jQuery-free date and time picker driving Pikaday (date) and the vanilla
 * Clockpicker fork (time) via their plain APIs. Each visible text input acts as
 * a facade; the final normalized value is written to a hidden data locker
 * (YYYY-MM-DD, HH:mm:ss, or "YYYY-MM-DD HH:mm:ss" when both are present).
 *
 * Data attributes:
 * - data-control="datepicker" - enables the plugin on the wrapper element
 * - data-datepicker - the visible date facade input (text)
 * - data-timepicker - the visible time facade input (text)
 * - data-datetime-value - the hidden locker input carrying the stored value
 * - data-default-time-midnight - fill a missing time with 00:00 instead of the current time
 * - data-ignore-timezone - accepted for October parity, no conversion happens yet
 *
 * Config (data-* on the wrapper, camelCased by the framework):
 * - format - date display format (YYYY YY MMMM MMM MM M DD Do D dddd ddd, [literal])
 * - minDate - earliest selectable date (ISO string)
 * - maxDate - latest selectable date (ISO string)
 * - yearRange - years either side in the year dropdown, or [lower, upper] (default 10)
 * - disableDays - weekday numbers (0 = Sunday) or YYYY-MM-DD dates that cannot be picked
 * - firstDay - first day of the week, 0 = Sunday (default 0)
 * - showWeekNumber - show an ISO week-number column
 * - twelveHour - use a 12 hour AM/PM time picker
 * - hoursOnly - pick the hour only, minutes are stored as 00
 *
 * Events:
 * - trigger:disable - rechecks the readonly/disabled state and binds or unbinds the pickers
 *
 * Standalone divergences from October's toolbox datepicker: no Moment.js, so the
 * formatter and parser above cover the date tokens only and there is no locale
 * default format or Pikaday i18n; timezone conversion waits on the user timezone
 * seam; date-only and time-only fields store just their part, where October
 * always stores a full date and time.
 */
'use strict';

import Pikaday from '../../vendor/pikaday/pikaday.esm.js';
import { Clockpicker } from './clockpicker.js';

const DB_DATE_FORMAT = 'YYYY-MM-DD';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DATE_TOKENS = /\[[^\]]*\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|Do|D/g;

const TOKEN_PATTERNS = {
    YYYY: '\\d{4}',
    YY: '\\d{2}',
    MMMM: '[A-Za-z]+',
    MMM: '[A-Za-z]+',
    MM: '\\d{2}',
    M: '\\d{1,2}',
    dddd: '[A-Za-z]+',
    ddd: '[A-Za-z]+',
    DD: '\\d{2}',
    Do: '\\d{1,2}(?:st|nd|rd|th)',
    D: '\\d{1,2}'
};

const pad = (n) => String(n).padStart(2, '0');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ordinal = (n) => {
    const suffixes = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
};

export function registerDatepicker(jax) {
    jax.registerControl('datepicker', class extends jax.ControlBase {
        init() {
            this.config = Object.assign({
                format: null,
                minDate: null,
                maxDate: null,
                yearRange: 10,
                disableDays: null,
                firstDay: 0,
                showWeekNumber: false,
                twelveHour: false,
                hoursOnly: false
            }, this.config);

            this.picker = null;
            this.timePicker = null;
        }

        connect() {
            this.dateFacade = this.element.querySelector('[data-datepicker]');
            this.timeFacade = this.element.querySelector('[data-timepicker]');
            this.locker = this.element.querySelector('[data-datetime-value]');

            this.hasDate = !!this.dateFacade;
            this.hasTime = !!this.timeFacade;
            this.defaultTimeMidnight = this.element.hasAttribute('data-default-time-midnight');
            this.disabledDays = Array.isArray(this.config.disableDays) ? this.config.disableDays : [];

            if (!this.hasDate && !this.hasTime) {
                return;
            }

            this.syncFacadesFromLocker();
            this.checkPickerStates();

            this.listen('change', '[data-datepicker], [data-timepicker]', this.onFacadeChange);
            this.listen('trigger:disable', this.checkPickerStates);
        }

        disconnect() {
            this.destroyDatePicker();
            this.destroyTimePicker();

            this.dateFacade = null;
            this.timeFacade = null;
            this.locker = null;
        }

        // Binds a picker to each editable facade and unbinds readonly or disabled ones.
        checkPickerStates() {
            if (jax.changeMonitor) {
                jax.changeMonitor.disable();
            }

            this.isBinding = true;

            try {
                if (this.hasDate) {
                    const dateEnabled = this.isFacadeEnabled(this.dateFacade);
                    if (!dateEnabled && this.picker) {
                        this.destroyDatePicker();
                    }
                    else if (dateEnabled && !this.picker) {
                        this.initDatePicker();
                    }
                }

                if (this.hasTime) {
                    const timeEnabled = this.isFacadeEnabled(this.timeFacade);
                    if (!timeEnabled && this.timePicker) {
                        this.destroyTimePicker();
                    }
                    else if (timeEnabled && !this.timePicker) {
                        this.initTimePicker();
                    }
                }
            }
            finally {
                this.isBinding = false;

                if (jax.changeMonitor) {
                    jax.changeMonitor.enable();
                }
            }
        }

        isFacadeEnabled(input) {
            return !input.hasAttribute('readonly') && !input.disabled;
        }

        //
        // Date picker
        //

        initDatePicker() {
            const options = {
                field: this.dateFacade,
                format: this.getDateFormat(),
                yearRange: this.config.yearRange,
                firstDay: Number(this.config.firstDay) || 0,
                showWeekNumber: !!this.config.showWeekNumber,
                keyboardInput: false,
                toString: (date) => this.formatDate(date, this.getDateFormat()),
                parse: (value) => this.parseDate(value),
                disableDayFn: (date) => this.isDateDisabled(date),
                onSelect: () => this.onSetLockerValue(),
                onOpen: () => this.alignDatePicker()
            };

            const minDate = this.parseIsoDate(this.config.minDate);
            if (minDate) {
                options.minDate = minDate;
            }

            const maxDate = this.parseIsoDate(this.config.maxDate);
            if (maxDate) {
                options.maxDate = maxDate;
            }

            this.picker = new Pikaday(options);
        }

        destroyDatePicker() {
            if (this.picker) {
                this.picker.destroy();
                this.picker = null;
            }
        }

        isDateDisabled(date) {
            const compareDate = this.formatDate(date, DB_DATE_FORMAT);

            return this.disabledDays.some((disabledDay) => {
                return disabledDay === date.getDay() || disabledDay === compareDate;
            });
        }

        // Aligns the calendar to the right edge of the facade, like October, when it fits on screen.
        alignDatePicker() {
            const el = this.picker ? this.picker.el : null;
            if (!el || !this.dateFacade) {
                return;
            }

            const rect = this.dateFacade.getBoundingClientRect();
            if (rect.right - el.offsetWidth < 0) {
                return;
            }

            el.style.left = 'auto';
            el.style.right = (document.documentElement.clientWidth - rect.right - window.scrollX) + 'px';
        }

        // Returns the picked date as YYYY-MM-DD, or today when none is picked.
        getDatePickerValue() {
            let date = null;

            if (this.hasDate) {
                date = this.parseDate(this.dateFacade.value) || (this.picker ? this.picker.getDate() : null);
            }

            return this.formatDate(date || new Date(), DB_DATE_FORMAT);
        }

        getDateFormat() {
            return this.config.format || DB_DATE_FORMAT;
        }

        //
        // Time picker
        //

        initTimePicker() {
            this.timePicker = new Clockpicker(this.timeFacade, {
                autoclose: true,
                placement: 'auto',
                align: 'right',
                twelvehour: !!this.config.twelveHour,
                afterDone: () => this.onSetLockerValue(),
                afterHourSelect: () => this.onAfterHourSelect()
            });
        }

        destroyTimePicker() {
            if (this.timePicker) {
                this.timePicker.remove();
                this.timePicker = null;
            }
        }

        // Completes the pick after the hour when only hours are selectable.
        onAfterHourSelect() {
            if (!this.config.hoursOnly || !this.timePicker) {
                return;
            }

            const hours = pad(this.timePicker.hours);

            this.timeFacade.value = this.config.twelveHour
                ? hours + ' ' + this.timePicker.amOrPm
                : hours;

            this.timePicker.hide();
            this.timeFacade.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Returns the picked time as HH:mm:ss, or midnight or the current time when none is picked.
        getTimePickerValue() {
            const value = this.hasTime ? this.formatTime(this.timeFacade.value) : '';
            if (value) {
                return value;
            }

            if (this.defaultTimeMidnight) {
                return '00:00:00';
            }

            const now = new Date();
            return pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
        }

        //
        // Locker
        //

        onFacadeChange(ev) {
            if (this.isBinding || this.isEmptying) {
                return;
            }

            if (!ev.target.value.trim()) {
                this.emptyValues();
            }
            else {
                this.onSetLockerValue();
            }
        }

        onSetLockerValue() {
            if (!this.locker) {
                return;
            }

            if (this.hasDate && this.hasTime) {
                this.locker.value = this.getDatePickerValue() + ' ' + this.getTimePickerValue();
            }
            else if (this.hasDate) {
                this.locker.value = this.getDatePickerValue();
            }
            else {
                this.locker.value = this.getTimePickerValue();
            }
        }

        // Loads the stored locker value into the facades on connect.
        syncFacadesFromLocker() {
            const { date, time } = this.splitLockerValue(this.locker ? this.locker.value : '');

            if (this.hasDate && date) {
                this.dateFacade.value = this.formatDate(this.parseIsoDate(date), this.getDateFormat());
            }

            if (this.hasTime && time) {
                this.timeFacade.value = this.formatTime(time, true);
            }
        }

        // Splits a stored value into its date and time parts, either may be missing.
        splitLockerValue(value) {
            const match = /^\s*(\d{4}-\d{2}-\d{2})?[T\s]*(\d{1,2}:\d{2}(?::\d{2})?)?/.exec(value || '');

            return {
                date: match && match[1] ? match[1] : null,
                time: match && match[2] ? match[2] : null
            };
        }

        emptyValues() {
            this.isEmptying = true;

            try {
                if (this.locker) {
                    this.locker.value = '';
                }
                if (this.hasDate) {
                    this.dateFacade.value = '';
                    if (this.picker) {
                        this.picker.setDate(null, true);
                    }
                }
                if (this.hasTime) {
                    this.timeFacade.value = '';
                }
            }
            finally {
                this.isEmptying = false;
            }
        }

        //
        // Formatting
        //

        // Formats a Date using the supported date tokens.
        formatDate(date, format) {
            if (!(date instanceof Date) || isNaN(date)) {
                return '';
            }

            return format.replace(DATE_TOKENS, (token) => {
                switch (token) {
                    case 'YYYY': return String(date.getFullYear());
                    case 'YY': return pad(date.getFullYear() % 100);
                    case 'MMMM': return MONTHS[date.getMonth()];
                    case 'MMM': return MONTHS[date.getMonth()].slice(0, 3);
                    case 'MM': return pad(date.getMonth() + 1);
                    case 'M': return String(date.getMonth() + 1);
                    case 'dddd': return WEEKDAYS[date.getDay()];
                    case 'ddd': return WEEKDAYS[date.getDay()].slice(0, 3);
                    case 'DD': return pad(date.getDate());
                    case 'Do': return ordinal(date.getDate());
                    case 'D': return String(date.getDate());
                    default: return token.slice(1, -1);
                }
            });
        }

        // Parses a display-formatted value into a Date, falling back to ISO (YYYY-MM-DD).
        parseDate(value) {
            if (!value) {
                return null;
            }

            return this.parseFormattedDate(value, this.getDateFormat()) || this.parseIsoDate(value);
        }

        // Parses a value written in the given format, rejecting impossible dates like 31 Feb.
        parseFormattedDate(value, format) {
            const fields = [];
            let pattern = '',
                lastIndex = 0;

            for (const match of format.matchAll(DATE_TOKENS)) {
                const token = match[0];
                pattern += escapeRegExp(format.slice(lastIndex, match.index));
                lastIndex = match.index + token.length;

                if (token.charAt(0) === '[') {
                    pattern += escapeRegExp(token.slice(1, -1));
                    continue;
                }

                pattern += '(' + TOKEN_PATTERNS[token] + ')';
                fields.push(token);
            }

            pattern += escapeRegExp(format.slice(lastIndex));

            const result = new RegExp('^\\s*' + pattern + '\\s*$', 'i').exec(value);
            if (!result) {
                return null;
            }

            let year = new Date().getFullYear(),
                month = 0,
                day = 1;

            for (const [index, token] of fields.entries()) {
                const part = result[index + 1];

                if (token === 'YYYY') {
                    year = Number(part);
                }
                else if (token === 'YY') {
                    year = Number(part) + (Number(part) > 68 ? 1900 : 2000);
                }
                else if (token === 'MMMM' || token === 'MMM') {
                    month = MONTHS.findIndex((name) => name.slice(0, 3).toLowerCase() === part.slice(0, 3).toLowerCase());
                }
                else if (token === 'MM' || token === 'M') {
                    month = Number(part) - 1;
                }
                else if (token === 'DD' || token === 'D' || token === 'Do') {
                    day = parseInt(part, 10);
                }
            }

            const date = new Date(year, month, day);

            if (month < 0 || date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
                return null;
            }

            return date;
        }

        // Parses the date part of an ISO value as a local date.
        parseIsoDate(value) {
            const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
            if (!iso) {
                return null;
            }

            return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        }

        // Normalizes a time facade value to HH:mm:ss for storage, or to the facade display
        // format (forDisplay) for the twelve hour and hours only modes.
        formatTime(value, forDisplay) {
            if (!value) {
                return '';
            }

            const match = /^\s*(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)?\s*$/i.exec(value);
            if (!match) {
                return '';
            }

            let hours = Number(match[1]);
            const minutes = match[2] || '00',
                seconds = match[3] || '00',
                meridiem = match[4] ? match[4].toUpperCase() : null;

            if (meridiem === 'PM' && hours < 12) {
                hours += 12;
            }
            if (meridiem === 'AM' && hours === 12) {
                hours = 0;
            }

            if (hours > 23 || Number(minutes) > 59 || Number(seconds) > 59) {
                return '';
            }

            if (forDisplay) {
                const displayMinutes = this.config.hoursOnly ? '' : ':' + minutes;

                // Clockpicker expects "hh:mm AM/PM" in twelve hour mode
                if (this.config.twelveHour) {
                    const displayMeridiem = hours >= 12 ? 'PM' : 'AM',
                        displayHours = (hours % 12) || 12;
                    return pad(displayHours) + displayMinutes + ' ' + displayMeridiem;
                }

                return pad(hours) + displayMinutes;
            }

            return pad(hours) + ':' + minutes + ':' + seconds;
        }
    });
}
