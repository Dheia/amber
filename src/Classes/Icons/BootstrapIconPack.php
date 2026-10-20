<?php namespace Larajax\Ui\Classes\Icons;

class BootstrapIconPack implements IconPack
{
    public function icons(): array
    {
        return [
            'action.delete' => 'bi bi-trash',

            'search.icon' => 'bi bi-search',
            'search.clear' => 'bi bi-x',

            'filter.menu' => 'bi bi-funnel',
            'filter.clear' => 'bi bi-eraser',
            'filter.caret' => 'bi bi-chevron-down',
            'filter.item.add' => 'bi bi-plus',
            'filter.item.remove' => 'bi bi-x',

            'checkboxlist.select_all' => 'bi bi-check2-square',
            'checkboxlist.clear' => 'bi bi-eraser',

            'tooltip.info' => 'bi bi-info-circle',

            'fileupload.upload' => 'bi bi-upload',
            'fileupload.remove' => 'bi bi-trash',
            'fileupload.reorder' => 'bi bi-grip-vertical',
            'fileupload.attachment' => 'bi bi-paperclip',
            'fileupload.error' => 'bi bi-exclamation-triangle',

            'datepicker.date' => 'bi bi-calendar',
            'datepicker.time' => 'bi bi-clock',

            'recordfinder.find' => 'bi bi-search',
            'recordfinder.remove' => 'bi bi-x-lg',
            'recordfinder.record' => 'bi bi-link-45deg',

            'repeater.add' => 'bi bi-plus-lg',
            'repeater.menu' => 'bi bi-gear',
            'repeater.reorder' => 'bi bi-grip-vertical',
            'repeater.duplicate' => 'bi bi-copy',
            'repeater.expand' => 'bi bi-arrows-angle-expand',
            'repeater.collapse' => 'bi bi-arrows-angle-contract',
            'repeater.move_up' => 'bi bi-arrow-up',
            'repeater.move_down' => 'bi bi-arrow-down',
            'repeater.remove' => 'bi bi-trash',
            'repeater.toggle.open' => 'bi bi-chevron-up',
            'repeater.toggle.closed' => 'bi bi-chevron-down',
            'repeater.item.default' => 'bi bi-sticky',
            'repeater.group.default' => 'bi bi-square',

            'list.reorder' => 'bi bi-grip-vertical',
            'list.setup' => 'bi bi-sliders',
            'list.structure' => 'bi bi-diagram-3',
            'list.tree.expand' => 'bi bi-chevron-right',
            'list.tree.collapse' => 'bi bi-chevron-down',
            'list.sort.asc' => 'bi bi-chevron-up',
            'list.sort.desc' => 'bi bi-chevron-down',
            'list.switch.true' => 'bi bi-check-lg',
            'list.switch.false' => 'bi bi-x-lg',

            'pagination.first' => 'bi bi-chevron-double-left',
            'pagination.previous' => 'bi bi-chevron-left',
            'pagination.prev' => 'bi bi-chevron-left',
            'pagination.next' => 'bi bi-chevron-right',
            'pagination.last' => 'bi bi-chevron-double-right',

            'file.type.default' => 'bi bi-file-earmark',
            'file.type.file' => 'bi bi-file-earmark',
            'file.type.zip' => 'bi bi-file-zip',
            'file.type.archive' => 'bi bi-file-zip',
            'file.type.pdf' => 'bi bi-filetype-pdf',
            'file.type.doc' => 'bi bi-filetype-doc',
            'file.type.text' => 'bi bi-filetype-txt',
            'file.type.xls' => 'bi bi-filetype-xls',
            'file.type.csv' => 'bi bi-filetype-csv',
            'file.type.ppt' => 'bi bi-filetype-ppt',
            'file.type.jpg' => 'bi bi-filetype-jpg',
            'file.type.png' => 'bi bi-filetype-png',
            'file.type.image' => 'bi bi-file-earmark-image',
            'file.type.svg' => 'bi bi-filetype-svg',
            'file.type.audio' => 'bi bi-file-earmark-music',
            'file.type.video' => 'bi bi-file-earmark-play',
            'file.type.html' => 'bi bi-filetype-html',
            'file.type.css' => 'bi bi-filetype-css',
            'file.type.js' => 'bi bi-filetype-js',
            'file.type.jsx' => 'bi bi-file-earmark-code',
            'file.type.ts' => 'bi bi-filetype-tsx',
            'file.type.tsx' => 'bi bi-filetype-tsx',
            'file.type.vue' => 'bi bi-file-earmark-code',
            'file.type.sql' => 'bi bi-file-earmark-code',
            'file.type.rs' => 'bi bi-file-earmark-code',
            'file.type.code' => 'bi bi-file-earmark-code',
        ];
    }
}