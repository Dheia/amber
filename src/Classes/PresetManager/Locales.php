<?php namespace Larajax\Ui\Classes\PresetManager;

/**
 * Locales is a resource file with minimal dependencies
 *
 * @package larajax\ui
 * @author Alexey Bobkov, Samuel Georges
 */
class Locales
{
    /**
     * locales returns list of available locales
     */
    public static function locales(): array
    {
        $locales = [
            'ar'    => 'العربية',
            'be'    => 'Беларуская',
            'bg'    => 'Български',
            'ca'    => 'Català',
            'cs'    => 'Čeština',
            'da'    => 'Dansk',
            'de'    => 'Deutsch',
            'el'    => 'Ελληνικά',
            'en'    => 'English (United States)',
            'en-au' => 'English (Australia)',
            'en-ca' => 'English (Canada)',
            'en-gb' => 'English (United Kingdom)',
            'es'    => 'Español',
            'es-ar' => 'Español (Argentina)',
            'et'    => 'Eesti',
            'fa'    => 'فارسی',
            'fi'    => 'Suomi',
            'fr'    => 'Français',
            'fr-ca' => 'Français (Canada)',
            'hr'    => 'Hrvatski',
            'hu'    => 'Magyar',
            'id'    => 'Bahasa Indonesia',
            'it'    => 'Italiano',
            'ja'    => '日本語',
            'ko'    => '한국어',
            'lt'    => 'Lietuvių',
            'lv'    => 'Latviešu',
            'nb-no' => 'Norsk (Bokmål)',
            'nn-no' => 'Norsk (Nynorsk)',
            'nl'    => 'Nederlands',
            'pl'    => 'Polski',
            'pt-br' => 'Português (Brasil)',
            'pt-pt' => 'Português (Portugal)',
            'ro'    => 'Română',
            'ru'    => 'Русский',
            'sk'    => 'Slovenský',
            'sl'    => 'Slovenščina',
            'sv'    => 'Svenska',
            'th'    => 'ไทย',
            'tr'    => 'Türkçe',
            'uk'    => 'Українська мова',
            'vn'    => 'Tiếng việt',
            'zh-cn' => '简体中文',
            'zh-tw' => '繁體中文',
        ];

        // Sort locales alphabetically
        asort($locales);

        foreach ($locales as $code => &$label) {
            $label = "{$code} - {$label}";
        }

        return $locales;
    }

    /**
     * flags returns list of available locales with flag icons
     */
    public static function flags(): array
    {
        $flags = [
            'ar'    => 'flag-sa',
            'be'    => 'flag-by',
            'bg'    => 'flag-bg',
            'ca'    => 'flag-es-ct',
            'cs'    => 'flag-cz',
            'da'    => 'flag-dk',
            'de'    => 'flag-de',
            'el'    => 'flag-gr',
            'en'    => 'flag-us',
            'en-au' => 'flag-au',
            'en-ca' => 'flag-ca',
            'en-gb' => 'flag-gb',
            'es'    => 'flag-es',
            'es-ar' => 'flag-ar',
            'et'    => 'flag-ee',
            'fa'    => 'flag-ir',
            'fi'    => 'flag-fi',
            'fr'    => 'flag-fr',
            'fr-ca' => 'flag-ca',
            'hr'    => 'flag-hr',
            'hu'    => 'flag-hu',
            'id'    => 'flag-id',
            'it'    => 'flag-it',
            'ja'    => 'flag-jp',
            'ko'    => 'flag-kr',
            'lt'    => 'flag-lt',
            'lv'    => 'flag-lv',
            'nb-no' => 'flag-no',
            'nn-no' => 'flag-no',
            'nl'    => 'flag-nl',
            'pl'    => 'flag-pl',
            'pt-br' => 'flag-br',
            'pt-pt' => 'flag-pt',
            'ro'    => 'flag-ro',
            'ru'    => 'flag-ru',
            'sk'    => 'flag-sk',
            'sl'    => 'flag-si',
            'sv'    => 'flag-se',
            'th'    => 'flag-th',
            'tr'    => 'flag-tr',
            'uk'    => 'flag-ua',
            'vn'    => 'flag-vn',
            'zh-cn' => 'flag-cn',
            'zh-tw' => 'flag-hk',
        ];

        $locales = [];

        foreach (self::locales() as $code => $label) {
            if (isset($flags[$code])) {
                $locales[$code] = [$label, $flags[$code]];
            }
        }

        return $locales;
    }

    /**
     * flagsShort returns list of available locales with flag icons
     * using codes instead of full labels
     */
    public static function flagsShort(): array
    {
        $locales = self::flags();

        foreach ($locales as $code => $preset) {
            $locales[$code][0] = $code;
        }

        return $locales;
    }

    /**
     * @deprecated
     */
    public static function localeIcons(): array
    {
        return self::flags();
    }
}
