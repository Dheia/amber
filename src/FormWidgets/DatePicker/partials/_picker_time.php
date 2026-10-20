<!-- Time -->
<div class="input-with-icon right-align">
    <?= \Larajax\Ui\Facades\Ui::icon('datepicker.time', ['class' => 'icon']) ?>
    <input
        type="text"
        id="<?= $this->getId('time') ?>"
        class="form-control align-right"
        autocomplete="off"
        <?= $field->getAttributes() ?>
        data-timepicker />
</div>
