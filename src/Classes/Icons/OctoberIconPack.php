<?php namespace Larajax\Ui\Classes\Icons;

class OctoberIconPack implements IconPack
{
    public function icons(): array
    {
        return [
            'action.delete' => 'oc-icon-delete',

            'search.icon' => 'icon-search',
            'search.clear' => 'storm-icon',

            'filter.menu' => 'ph ph-funnel-simple',
            'filter.clear' => 'icon-eraser',
            'filter.caret' => 'icon-angle-down',
            'filter.item.add' => 'icon-plus',
            'filter.item.remove' => 'icon-times',

            'checkboxlist.select_all' => 'icon-check-multi',
            'checkboxlist.clear' => 'icon-eraser',

            'tooltip.info' => 'icon-info-circle',

            'fileupload.upload' => 'icon-common-file-upload',
            'fileupload.remove' => 'icon-common-file-remove',
            'fileupload.reorder' => 'icon-list-reorder',
            'fileupload.attachment' => 'icon-attachment',
            'fileupload.error' => 'ph ph-warning',

            'datepicker.date' => 'icon-calendar',
            'datepicker.time' => 'icon-clock',

            'recordfinder.find' => 'icon-common-file-star',
            'recordfinder.remove' => 'icon-common-file-remove',
            'recordfinder.record' => 'icon-chain',

            'repeater.add' => 'icon-add-bold',
            'repeater.menu' => 'icon-cog',
            'repeater.reorder' => 'icon-list-reorder',
            'repeater.duplicate' => 'icon-copy',
            'repeater.expand' => 'icon-expand',
            'repeater.collapse' => 'icon-collapse',
            'repeater.move_up' => 'icon-long-arrow-up',
            'repeater.move_down' => 'icon-long-arrow-down',
            'repeater.remove' => 'icon-delete',
            'repeater.toggle.open' => 'icon-angle-up',
            'repeater.toggle.closed' => 'icon-angle-down',
            'repeater.item.default' => 'icon-sticky-note',
            'repeater.group.default' => 'icon-square',

            'list.reorder' => 'icon-list-reorder',
            'list.setup' => 'icon-list-ul',
            'list.structure' => 'icon-sitemap',
            'list.tree.expand' => 'icon-angle-right',
            'list.tree.collapse' => 'icon-angle-down',
            'list.sort.asc' => 'icon-angle-up',
            'list.sort.desc' => 'icon-angle-down',
            'list.switch.true' => 'icon-check',
            'list.switch.false' => 'icon-times',

            'pagination.first' => 'icon-angle-double-left',
            'pagination.previous' => 'icon-angle-left',
            'pagination.prev' => 'icon-angle-left',
            'pagination.next' => 'icon-angle-right',
            'pagination.last' => 'icon-angle-double-right',

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