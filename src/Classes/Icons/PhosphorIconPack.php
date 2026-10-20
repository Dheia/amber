<?php namespace Larajax\Ui\Classes\Icons;

class PhosphorIconPack implements IconPack
{
    public function icons(): array
    {
        return [
            'action.delete' => 'ph ph-trash',

            'search.icon' => 'ph ph-magnifying-glass',
            'search.clear' => 'ph ph-x',

            'filter.menu' => 'ph ph-funnel-simple',
            'filter.clear' => 'ph ph-eraser',
            'filter.caret' => 'ph ph-caret-down',
            'filter.item.add' => 'ph ph-plus',
            'filter.item.remove' => 'ph ph-x',

            'checkboxlist.select_all' => 'ph ph-checks',
            'checkboxlist.clear' => 'ph ph-eraser',

            'tooltip.info' => 'ph ph-info',

            'fileupload.upload' => 'ph ph-upload-simple',
            'fileupload.remove' => 'ph ph-trash',
            'fileupload.reorder' => 'ph ph-dots-six-vertical',
            'fileupload.attachment' => 'ph ph-paperclip',
            'fileupload.error' => 'ph ph-warning',

            'datepicker.date' => 'ph ph-calendar-blank',
            'datepicker.time' => 'ph ph-clock',

            'recordfinder.find' => 'ph ph-magnifying-glass',
            'recordfinder.remove' => 'ph ph-x',
            'recordfinder.record' => 'ph ph-link',

            'repeater.add' => 'ph ph-plus',
            'repeater.menu' => 'ph ph-gear',
            'repeater.reorder' => 'ph ph-dots-six-vertical',
            'repeater.duplicate' => 'ph ph-copy',
            'repeater.expand' => 'ph ph-arrows-out-simple',
            'repeater.collapse' => 'ph ph-arrows-in-simple',
            'repeater.move_up' => 'ph ph-arrow-up',
            'repeater.move_down' => 'ph ph-arrow-down',
            'repeater.remove' => 'ph ph-trash',
            'repeater.toggle.open' => 'ph ph-caret-up',
            'repeater.toggle.closed' => 'ph ph-caret-down',
            'repeater.item.default' => 'ph ph-note',
            'repeater.group.default' => 'ph ph-square',

            'list.reorder' => 'ph ph-dots-six-vertical',
            'list.setup' => 'ph ph-sliders-horizontal',
            'list.structure' => 'ph ph-tree-structure',
            'list.tree.expand' => 'ph ph-caret-right',
            'list.tree.collapse' => 'ph ph-caret-down',
            'list.sort.asc' => 'ph ph-caret-up',
            'list.sort.desc' => 'ph ph-caret-down',
            'list.switch.true' => 'ph ph-check',
            'list.switch.false' => 'ph ph-x',

            'pagination.first' => 'ph ph-caret-double-left',
            'pagination.previous' => 'ph ph-caret-left',
            'pagination.prev' => 'ph ph-caret-left',
            'pagination.next' => 'ph ph-caret-right',
            'pagination.last' => 'ph ph-caret-double-right',

            'file.type.default' => 'ph ph-file',
            'file.type.file' => 'ph ph-file',
            'file.type.zip' => 'ph ph-file-zip',
            'file.type.archive' => 'ph ph-file-archive',
            'file.type.pdf' => 'ph ph-file-pdf',
            'file.type.doc' => 'ph ph-file-doc',
            'file.type.text' => 'ph ph-file-text',
            'file.type.xls' => 'ph ph-file-xls',
            'file.type.csv' => 'ph ph-file-csv',
            'file.type.ppt' => 'ph ph-file-ppt',
            'file.type.jpg' => 'ph ph-file-jpg',
            'file.type.png' => 'ph ph-file-png',
            'file.type.image' => 'ph ph-file-image',
            'file.type.svg' => 'ph ph-file-svg',
            'file.type.audio' => 'ph ph-file-audio',
            'file.type.video' => 'ph ph-file-video',
            'file.type.html' => 'ph ph-file-html',
            'file.type.css' => 'ph ph-file-css',
            'file.type.js' => 'ph ph-file-js',
            'file.type.jsx' => 'ph ph-file-jsx',
            'file.type.ts' => 'ph ph-file-ts',
            'file.type.tsx' => 'ph ph-file-tsx',
            'file.type.vue' => 'ph ph-file-vue',
            'file.type.sql' => 'ph ph-file-sql',
            'file.type.rs' => 'ph ph-file-rs',
            'file.type.code' => 'ph ph-file-code',
        ];
    }
}