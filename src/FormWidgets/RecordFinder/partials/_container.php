<?php if ($this->previewMode && !$value): ?>

    <span class="form-control" disabled="disabled">
        <?= e(__("There is no record selected.")) ?>
    </span>

<?php else: ?>

    <div class="recordfinder-widget" id="<?= $this->getId('container') ?>">
        <?= $this->makePartial('recordfinder') ?>
    </div>

<?php endif ?>
