<?php namespace Larajax\Ui\Classes;

use Illuminate\Support\Facades\Session;

/**
 * PreferenceStore is a session-backed store for widget user preferences, replaced by
 * overriding `getPreferenceStorage` on the consuming class.
 *
 * @package larajax\ui
 * @author Alexey Bobkov, Samuel Georges
 */
class PreferenceStore
{
    /**
     * @var string sessionKey base for stored preferences
     */
    protected string $sessionKey = 'larajax.ui.preferences';

    /**
     * get a preference value
     */
    public function get(string $key, $default = null)
    {
        return Session::get($this->sessionKey.'.'.$key, $default);
    }

    /**
     * set a preference value
     */
    public function set(string $key, $value): void
    {
        Session::put($this->sessionKey.'.'.$key, $value);
    }

    /**
     * reset removes a preference value
     */
    public function reset(string $key): void
    {
        Session::forget($this->sessionKey.'.'.$key);
    }
}
