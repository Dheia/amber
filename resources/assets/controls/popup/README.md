# Popups

Displays a modal popup, based on the Bootstrap 5 modal. The Bootstrap 5 JS bundle must be loaded as a global (`window.bootstrap`).

## Remote popups

Content for the popup can be loaded remotely using an AJAX request. Use the `data-handler` attribute to populate a popup with the contents of an AJAX handler.

```html
<a
    data-control="popup"
    data-handler="onLoadContent"
    href="javascript:;"
    class="btn btn-primary btn-lg">
    Launch Ajax Form
</a>
```

Using the `data-ajax` attribute you can refer to an external file or URL directly.

```html
<a
    data-control="popup"
    data-ajax="popup-content.htm"
    href="javascript:;"
    class="btn btn-primary btn-lg">
    Launch Ajax Form
</a>
```

The partial for your rendered popup should follow this structure:

```html
<div class="modal-header">
    <h4 class="modal-title">
        Send email
    </h4>
    <button type="button" class="btn-close" data-dismiss="popup"></button>
</div>
<div class="modal-body">
    <!-- Any popup content goes here -->
</div>
<div class="modal-footer">
    <button
        type="submit"
        class="btn btn-primary"
        data-request="onSend"
        data-popup-load-indicator>
        Send
    </button>
    <button
        type="button"
        class="btn btn-default"
        data-dismiss="popup">
        Close
    </button>
</div>
```

A `data-popup-size` attribute on the first element, or on any element inside the content, sets the popup size from the response.

## API documentation

### Options

- `handler` - AJAX handler name
- `ajax` - URL to load the content from
- `content` - content HTML string, DOM node or callback
- `extraData` - extra request data, an object or `key: value` string
- `size` - popup size: giant, huge, large, small, tiny, or a pixel size such as 600
- `keyboard` - allow the popup to be closed with the keyboard (default `true`)
- `adaptiveHeight` - stretch the popup to the window height
- `zIndex` - explicit z-index for the backdrop (the popup sits 20 above it)

### Data attributes

- `data-control="popup"` - enables the popup on click
- `data-ajax="popup-content.htm"` - ajax content to load
- `data-handler="onLoadContent"` - AJAX handler name
- `data-keyboard="false"` - disallow closing the popup with the keyboard
- `data-extra-data="file_id: 1"` - extra request data (the element's `data-request-data` is merged as well)
- `data-size="large"` - popup size
- `data-dismiss="popup"` - inside a popup, closes it when clicked
- `data-popup-load-indicator` - inside a popup, on an element with `data-request`, hides the popup behind the loading indicator while that request runs, and shakes it on failure

### JavaScript API

```js
import { Popup } from 'larajax-ui';

Popup.open({ ajax: 'popup-content.htm' });
Popup.open({ handler: 'onLoadSomePopup', extraData: { id: 3 } });

// Create or reload the popup for a trigger element
Popup.fromElement(link, { handler: 'onLoadSomePopup' });

// Call a method on an open popup, from its trigger, its container or the first div of its content
Popup.getInstance(element).hide();
Popup.fromElement(element, 'lock', true);
```

The class is also available as `jax.popup`. Instance methods: `show()`, `hide()`, `reload()`, `toggle()`, `lock(bool)`, `visible(bool)`, `setLoading(bool)`, `setShake()`, `hideLoading()`.

- `jax.popup.bindToPopups(container, vars)` - adds the variables as hidden inputs to the form of any popup opened from inside the container
- `jax.popup.focusFirstInput(container)` - focuses the first input when nothing has an `autofocus` attribute

### Events

Dispatched on the trigger element and on the first div of the popup content. `event.detail` holds `popup`, `trigger` and `modal`.

| Event | Description |
|---|---|
| `popup:show` | The content was placed and the popup is showing |
| `popup:shown` | The show transition finished |
| `popup:hide` | The popup is closing |
| `popup:hidden` | The popup closed and was removed |
| `popup:complete` | The handler content loaded |
| `popup:error` | The handler request failed |
| `popup:toggle` | `toggle()` was called |
| `popup:download` | The handler responded with a file download |

Dispatch `popup:close` on the popup or any element inside it to close it.

```js
element.dispatchEvent(new CustomEvent('popup:close', { bubbles: true }));
```

`popup:show` is also dispatched on the document when a popup starts opening.

## Popup stacker

`jax.popupStacker` pushes open popups back, scaled and offset, when another popup opens over them, and pulls the next one forward when the top popup closes. `jax.popupStacker.getFirstPopup()` returns the topmost open popup.
