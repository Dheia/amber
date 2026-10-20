<?php namespace Larajax\Ui\Helpers;

use Date;
use Config;
use Carbon\Carbon;
use DateTime as PhpDateTime;
use DateTimeZone;
use InvalidArgumentException;
use Exception;

/**
 * DateTime helper
 *
 * @package larajax\ui
 * @author Alexey Bobkov, Samuel Georges
 */
class DateTime
{
    /**
     * @var callable|null timezoneResolver returns the timezone of the person viewing the page.
     */
    protected static $timezoneResolver;

    /**
     * resolveTimezoneUsing sets the callback that returns the viewer's timezone, or null to use the app timezone.
     */
    public static function resolveTimezoneUsing(?callable $resolver): void
    {
        static::$timezoneResolver = $resolver;
    }

    /**
     * appTimezone returns the timezone values are stored in.
     */
    public static function appTimezone(): string
    {
        return Config::get('app.timezone') ?: date_default_timezone_get();
    }

    /**
     * userTimezone returns the viewer's timezone, falling back to the app timezone when the resolver gives an invalid one.
     */
    public static function userTimezone(): string
    {
        $timezone = static::$timezoneResolver ? (static::$timezoneResolver)() : null;

        if ($timezone instanceof DateTimeZone) {
            return $timezone->getName();
        }

        if (is_string($timezone) && $timezone !== '') {
            try {
                return (new DateTimeZone($timezone))->getName();
            }
            catch (Exception $ex) {
                // Fall back to the app timezone
            }
        }

        return static::appTimezone();
    }

    /**
     * toUserTimezone converts a stored value to the viewer's timezone.
     */
    public static function toUserTimezone($value): Carbon
    {
        return self::makeCarbon($value)->copy()->setTimezone(static::userTimezone());
    }

    /**
     * fromUserTimezone reads a date and time entered in the viewer's timezone and converts it to the app timezone.
     */
    public static function fromUserTimezone(string $value): Carbon
    {
        return Date::parse($value, static::userTimezone())->setTimezone(static::appTimezone());
    }

    /**
     * timeSince returns a human readable time difference from the value to the
     * current time. Eg: **10 minutes ago**
     *
     * @return string
     */
    public static function timeSince($datetime)
    {
        return self::makeCarbon($datetime)->diffForHumans();
    }

    /**
     * timeTense returns 24-hour time and the day using the grammatical tense
     * of the current time. Eg: Today at 12:49, Yesterday at 4:00
     * or 18 Sep 2015 at 14:33.
     *
     * @return string
     */
    public static function timeTense($datetime)
    {
        $datetime = self::makeCarbon($datetime);
        $time = $datetime->format('H:i');
        $date = $datetime->format('j M Y');

        if ($datetime->isToday()) {
            $date = 'Today';
        }
        elseif ($datetime->isYesterday()) {
            $date = 'Yesterday';
        }
        elseif ($datetime->isTomorrow()) {
            $date = 'Tomorrow';
        }

        return $date.' at '.$time;
    }

    /**
     * makeCarbon converts mixed inputs to a Carbon object.
     *
     * @return Carbon\Carbon
     */
    public static function makeCarbon($value, $throwException = true)
    {
        if ($value instanceof Carbon) {
            // Do nothing
        }
        elseif ($value instanceof PhpDateTime) {
            $value = Date::instance($value);
        }
        elseif (is_numeric($value)) {
            $value = Date::createFromTimestamp($value);
        }
        elseif (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value)) {
            $value = Date::createFromFormat('Y-m-d', $value)->startOfDay();
        }
        else {
            try {
                $value = Date::parse($value);
            }
            catch (Exception $ex) {
                // Do nothing
            }
        }

        if (!$value instanceof Carbon && $throwException) {
            throw new InvalidArgumentException('Invalid date value supplied to DateTime helper.');
        }

        return $value;
    }

    /**
     * momentFormat converts a PHP date format to "Moment.js" format.
     * @param string $format
     * @return string
     */
    public static function momentFormat($format)
    {
        if (!$format) {
            return '';
        }

        $replacements = [
            'd' => 'DD',
            'D' => 'ddd',
            'j' => 'D',
            'l' => 'dddd',
            'N' => 'E',
            'S' => 'o',
            'w' => 'e',
            'z' => 'DDD',
            'W' => 'W',
            'F' => 'MMMM',
            'm' => 'MM',
            'M' => 'MMM',
            'n' => 'M',
            't' => '', // no equivalent
            'L' => '', // no equivalent
            'o' => 'YYYY',
            'Y' => 'YYYY',
            'y' => 'YY',
            'a' => 'a',
            'A' => 'A',
            'B' => '', // no equivalent
            'g' => 'h',
            'G' => 'H',
            'h' => 'hh',
            'H' => 'HH',
            'i' => 'mm',
            's' => 'ss',
            'u' => 'SSS',
            'e' => 'zz', // deprecated since version 1.6.0 of moment.js
            'I' => '', // no equivalent
            'O' => '', // no equivalent
            'P' => '', // no equivalent
            'T' => '', // no equivalent
            'Z' => '', // no equivalent
            'c' => '', // no equivalent
            'r' => '', // no equivalent
            'U' => 'X',
        ];

        foreach ($replacements as $from => $to) {
            $replacements['\\'.$from] = '['.$from.']';
        }

        return strtr($format, $replacements);
    }
}
