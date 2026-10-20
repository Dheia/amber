/*
 * RecordFinder control
 *
 * Data attributes:
 * - data-control="recordfinder" - enables the control on an element
 *
 * JavaScript API:
 * jax.fetchControl(element, 'recordfinder')
 */
'use strict';

import { Popup } from '../../controls/popup/popup.js';
import { LoadIndicator } from '../../controls/load-indicator/load-indicator.js';

export function registerRecordFinder(jax) {
    jax.registerControl('recordfinder', class extends jax.ControlBase {
        init() {
            this.config = Object.assign({
                refreshHandler: null,
                dataLocker: null
            }, this.config);
        }

        connect() {
            this.listen('dblclick', this.onDoubleClick);
        }

        disconnect() {
        }

        onDoubleClick(ev) {
            const findButton = this.element.querySelector('.toolbar-find-button');
            if (findButton) {
                findButton.click();
            }
        }

        updateRecord(linkEl, recordId) {
            if (!this.config.dataLocker) {
                return;
            }

            // Selector name must be used because by the time success runs
            // - this.config will be disposed
            // - locker element will be replaced
            var locker = this.config.dataLocker;

            document.querySelector(locker).value = recordId;

            LoadIndicator.show(this.element, { opaque: true });
            jax.request(this.element, this.config.refreshHandler, {
                afterUpdate: function() {
                    var lockerEl = document.querySelector(locker);
                    if (lockerEl) {
                        lockerEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            });

            var popup = Popup.getInstance(linkEl.closest('.recordfinder-popup'));
            if (popup) {
                popup.hide();
            }
        }
    });
}
