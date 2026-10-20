<!-- Date -->
<div class="input-with-icon right-align">
    <?= \Larajax\Ui\Facades\Ui::icon('datepicker.date', ['class' => 'icon']) ?>
    <input
        type="text"
        id="<?= $this->getId('date') ?>"
        class="form-control align-right"
        autocomplete="off"
        <?= $field->getAttributes() ?>
        data-datepicker />
</div>
