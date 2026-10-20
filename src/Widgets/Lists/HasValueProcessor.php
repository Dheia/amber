<?php namespace Larajax\Ui\Widgets\Lists;

use Str;
use Html;
use Lang;
use Carbon\Carbon;
use October\Rain\Router\Helper as RouterHelper;
use Larajax\Ui\Helpers\DateTime as DateTimeHelper;
use Larajax\Ui\Classes\FormField;
use ApplicationException;

/**
 * HasValueProcessor concern
 */
trait HasValueProcessor
{

    //
    // Value processing
    //

    /**
     * evalCustomListType processes a custom list types registered by plugins and the app.
     */
    protected function evalCustomListType($type, $record, $column, $value)
    {
        $customMessage = '';
        if ($type === 'relation') {
            $customMessage = 'Type: relation is not supported, instead use the relation property to specify a relationship to pull the value from and set the type to the type of the value expected.';
        }

        throw new ApplicationException(sprintf('List column type "%s" could not be found. %s', $type, $customMessage));
    }

    /**
     * evalTextTypeValue as text and escape the value
     * @return string
     */
    protected function evalTextTypeValue($record, $column, $value)
    {
        if (is_array($value) && count($value) === count($value, COUNT_RECURSIVE)) {
            $value = implode(', ', $value);
        }

        if (is_string($column->format) && !empty($column->format)) {
            $value = sprintf($column->format, $value);
        }

        return htmlentities((string) $value, ENT_QUOTES, 'UTF-8', false);
    }

    /**
     * evalNumberTypeValue process as number, proxy to text but uses different styling
     * @return string
     */
    protected function evalNumberTypeValue($record, $column, $value)
    {
        return $this->evalTextTypeValue($record, $column, $value);
    }

    /**
     * evalImageTypeValue will process an image value
     * @return string
     */
    protected function evalImageTypeValue($record, $column, $value)
    {
        $config = $column->config;
        $width = isset($config['width']) ? $config['width'] : 68;
        $height = isset($config['height']) ? $config['height'] : 68;
        $limit = isset($config['limit']) ? $config['limit'] : 3;
        $options = isset($config['options']) ? $config['options'] : [];
        $isDefaultSize = !isset($config['width']) && !isset($config['height']);

        $colName = $column->columnName;
        $images = [];

        // File model
        if (isset($record->attachMany[$colName])) {
            $images = $value->count() ? $value->all() : [];
        }
        elseif (isset($record->attachOne[$colName])) {
            $images = $value ? [$value] : [];
        }
        // Path or URL value
        else {
            foreach ((array) $value as $val) {
                if (is_array($val)) {
                    return '';
                }
                if (strlen($val)) {
                    $images[] = $val;
                }
            }
        }

        if (!$images) {
            return '';
        }

        $totalImages = count($images);
        $images = array_slice($images, 0, $limit);

        $imageUrls = [];
        foreach ($images as $image) {
            $imageUrls[] = is_object($image) && method_exists($image, 'getThumb')
                ? $image->getThumb($width, $height, $options)
                : $image;
        }

        return $this->makePartial('column_image', [
            'totalImages' => $totalImages,
            'imageUrls' => $imageUrls,
            'isDefaultSize' => $isDefaultSize,
            'width' => $width,
            'height' => $height
        ]);
    }

    /**
     * evalFileTypeValue will process a file attachment value
     * @return string
     */
    protected function evalFileTypeValue($record, $column, $value)
    {
        $config = $column->config;
        $limit = $config['limit'] ?? 3;

        $colName = $column->columnName;
        $files = [];

        // File model
        if (isset($record->attachMany[$colName])) {
            $files = $value->count() ? $value->all() : [];
        }
        elseif (isset($record->attachOne[$colName])) {
            $files = $value ? [$value] : [];
        }

        if (!$files) {
            return '';
        }

        $totalFiles = count($files);
        $files = array_slice($files, 0, $limit);

        $fileItems = [];
        foreach ($files as $file) {
            $fileItems[] = [
                'url' => $file->getPath(),
                'name' => $file->file_name,
                'icon' => $this->getFileTypeIcon($file->getExtension()),
            ];
        }

        return $this->makePartial('column_file', [
            'totalFiles' => $totalFiles,
            'fileItems' => $fileItems,
            'column' => $column,
        ]);
    }

    /**
     * evalSwitchTypeValue as boolean switch
     */
    protected function evalSwitchTypeValue($record, $column, $value)
    {
        $config = $column->config;

        return $this->makePartial('column_switch', [
            'column' => $column,
            'value' => $value,
            'trueValue' => Lang::get($config['options'][1] ?? 'Yes'),
            'falseValue' => Lang::get($config['options'][0] ?? 'No'),
        ]);
    }

    /**
     * evalSummaryTypeValue will limit a value by words
     */
    protected function evalSummaryTypeValue($record, $column, $value)
    {
        $config = $column->config;
        $endChars = isset($config['endChars']) ? $config['endChars'] : '...';
        $limitChars = isset($config['limitChars']) ? $config['limitChars'] : 40;
        $limitWords = isset($config['limitWords']) ? $config['limitWords'] : null;

        // Handle null values
        if ($value === null) {
            return null;
        }

        // Collapse spacing for inline nodes that will get stripped
        // "Welcome <img />, User" should read "Welcome, User"
        $result = $value;
        $result = str_replace(' <', '<', $result);

        // Add natural spacing between HTML nodes
        $result = str_replace("><", '> <', $result);

        // Strip HTML
        $result = $original = trim(Html::strip($result));

        // Nothing left
        if (!strlen($result)) {
            return $result;
        }

        // Limit by chars and estimate word count
        if (!$limitWords) {
            $result = Str::limit($result, $limitChars, '');
            $limitWords = substr_count($result, ' ') + 1;
        }

        // Strip HTML, limit to words
        $result = Str::words($result, $limitWords, '');

        // Add end suffix where original differs
        if (mb_strlen($result) !== mb_strlen($original)) {
            $result .= $endChars;
        }

        return $result;
    }

    /**
     * evalDatetimeTypeValue as a datetime value
     */
    protected function evalDatetimeTypeValue($record, $column, $value)
    {
        if ($value === null) {
            return null;
        }

        $dateTime = $this->validateDateTimeValue($value, $column, true);

        if ($column->format !== null) {
            $value = $dateTime->format($column->format);
        }
        else {
            $value = $dateTime->toDayDateTimeString();
        }

        return $value;
    }

    /**
     * evalTimeTypeValue as a time value
     */
    protected function evalTimeTypeValue($record, $column, $value)
    {
        if ($value === null) {
            return null;
        }

        $dateTime = $this->validateDateTimeValue($value, $column, false);

        $format = $column->format ?? 'g:i A';

        $value = $dateTime->format($format);

        return $value;
    }

    /**
     * evalDateTypeValue as a date value
     */
    protected function evalDateTypeValue($record, $column, $value)
    {
        if ($value === null) {
            return null;
        }

        $dateTime = $this->validateDateTimeValue($value, $column, false);

        if ($column->format !== null) {
            $value = $dateTime->format($column->format);
        }
        else {
            $value = $dateTime->toFormattedDateString();
        }

        return $value;
    }

    /**
     * evalTimesinceTypeValue as diff for humans (1 min ago)
     */
    protected function evalTimesinceTypeValue($record, $column, $value)
    {
        if ($value === null) {
            return null;
        }

        $dateTime = $this->validateDateTimeValue($value, $column);

        return DateTimeHelper::timeSince($dateTime);
    }

    /**
     * evalTimetenseTypeValue as time as current tense (Today at 0:00)
     */
    protected function evalTimetenseTypeValue($record, $column, $value)
    {
        if ($value === null) {
            return null;
        }

        $dateTime = $this->validateDateTimeValue($value, $column, true);

        return DateTimeHelper::timeTense($dateTime);
    }

    /**
     * evalSelectableTypeValue processes as selectable value types for 'dropdown',
     * 'radio', 'balloon-selector' and similar form field types
     */
    protected function evalSelectableTypeValue($record, $column, $value)
    {
        $formField = new FormField([
            'fieldName' => $column->columnName,
            'label' => $column->label
        ]);

        $fieldOptions = $column->optionsPreset
            ? 'preset:' . $column->optionsPreset
            : ($column->optionsMethod ?: $column->options);

        if (!is_array($fieldOptions)) {
            $model = $this->isColumnRelated($column)
                ? app('model.inspector')->makeRelation($this->model, $column->relation)
                : $this->model;

            $fieldOptions = $formField->getOptionsFromModel(
                $model,
                $fieldOptions,
                $record
            );
        }

        return $this->makePartial('column_selectable', [
            'fieldOptions' => $fieldOptions,
            'column' => $column,
            'value' => $value
        ]);
    }

    /**
     * evalLinkageTypeValue
     */
    protected function evalLinkageTypeValue($record, $column, $value)
    {
        // Handle array value from custom link function: [$url, $text]
        if (is_array($value) && count($value) === 2) {
            $linkUrl = $value[0];
            $linkText = $value[1];
        }
        else {
            // Build link URL - always process linkUrl config with parameter replacement
            if ($column->linkUrl) {
                $linkUrl = RouterHelper::replaceParameters($record, $column->linkUrl);
                if (
                    !str_starts_with($linkUrl, '//') &&
                    !str_starts_with($linkUrl, 'http://') &&
                    !str_starts_with($linkUrl, 'https://')
                ) {
                    $linkUrl = url($linkUrl);
                }
            }
            else {
                $linkUrl = $value;
            }

            // Determine link text - prefer config, fall back to value
            $linkText = $column->linkText ?: $value;

            // When no value exists, use URL for both value and text
            if (!$value && $column->linkUrl) {
                $value = $linkUrl;
                if (!$column->linkText) {
                    $linkText = $linkUrl;
                }
            }
        }

        if (!$this->isSafeLinkageUrl((string) $linkUrl)) {
            return e(__($linkText));
        }

        return $this->makePartial('column_linkage', [
            'attributes' => (array) $column->attributes,
            'linkText' => $linkText,
            'linkUrl' => $linkUrl,
            'column' => $column,
            'value' => $value
        ]);
    }

    /**
     * isSafeLinkageUrl allows relative URLs and a short list of schemes, since browsers ignore control characters inside a scheme.
     */
    protected function isSafeLinkageUrl(string $url): bool
    {
        $url = preg_replace('/[\x00-\x20\x7f]+/', '', $url);

        if (!preg_match('/^([a-z][a-z0-9+.\-]*):/i', $url, $matches)) {
            return true;
        }

        return in_array(strtolower($matches[1]), ['http', 'https', 'ftp', 'ftps', 'mailto', 'tel', 'sms'], true);
    }

    /**
     * evalPartialTypeValue as partial reference
     */
    protected function evalPartialTypeValue($record, $column, $value)
    {
        return $this->makePartial('column_partial', [
            'record' => $record,
            'column' => $column,
            'value' => $value
        ]);
    }

    /**
     * evalColorPickerTypeValue as background color, to be seen at list
     */
    protected function evalColorPickerTypeValue($record, $column, $value)
    {
        return $this->makePartial('column_colorpicker', [
            'value' => $value
        ]);
    }

    /**
     * validateDateTimeValue column type, converted to the viewer's timezone when the column uses it (`$useTimezone` is the type's default).
     */
    protected function validateDateTimeValue($value, $column, $useTimezone = false)
    {
        $value = DateTimeHelper::makeCarbon($value, false);

        if (!$value instanceof Carbon) {
            throw new ApplicationException(sprintf(
                'List column value "%s" is not a valid date time object.',
                $column->columnName
            ));
        }

        if ($this->getColumnTimezonePreference($column, $useTimezone)) {
            $value = DateTimeHelper::toUserTimezone($value);
        }

        return $value;
    }

    /**
     * getFileTypeIcon returns the appropriate semantic icon for a file extension
     */
    protected function getFileTypeIcon(string $extension): string
    {
        $extension = strtolower($extension);

        $iconMap = [
            // Archives
            'zip' => 'file-zip',
            'rar' => 'file-archive',
            'tar' => 'file-archive',
            'gz' => 'file-archive',
            '7z' => 'file-archive',

            // Documents
            'pdf' => 'file-pdf',
            'doc' => 'file-doc',
            'docx' => 'file-doc',
            'txt' => 'file-text',
            'rtf' => 'file-text',

            // Spreadsheets
            'xls' => 'file-xls',
            'xlsx' => 'file-xls',
            'csv' => 'file-csv',

            // Presentations
            'ppt' => 'file-ppt',
            'pptx' => 'file-ppt',

            // Images
            'jpg' => 'file-jpg',
            'jpeg' => 'file-jpg',
            'png' => 'file-png',
            'gif' => 'file-image',
            'bmp' => 'file-image',
            'webp' => 'file-image',
            'svg' => 'file-svg',

            // Audio
            'mp3' => 'file-audio',
            'wav' => 'file-audio',
            'ogg' => 'file-audio',
            'flac' => 'file-audio',
            'aac' => 'file-audio',

            // Video
            'mp4' => 'file-video',
            'avi' => 'file-video',
            'mov' => 'file-video',
            'wmv' => 'file-video',
            'mkv' => 'file-video',
            'webm' => 'file-video',

            // Code
            'html' => 'file-html',
            'htm' => 'file-html',
            'css' => 'file-css',
            'js' => 'file-js',
            'jsx' => 'file-jsx',
            'ts' => 'file-ts',
            'tsx' => 'file-tsx',
            'vue' => 'file-vue',
            'sql' => 'file-sql',
            'rs' => 'file-rs',
            'php' => 'file-code',
            'py' => 'file-code',
            'rb' => 'file-code',
            'java' => 'file-code',
            'c' => 'file-code',
            'cpp' => 'file-code',
            'h' => 'file-code',
            'json' => 'file-code',
            'xml' => 'file-code',
            'yaml' => 'file-code',
            'yml' => 'file-code',
        ];

        $icon = $iconMap[$extension] ?? 'default';

        return 'file.type.' . (str_starts_with($icon, 'file-') ? substr($icon, 5) : $icon);
    }
}
