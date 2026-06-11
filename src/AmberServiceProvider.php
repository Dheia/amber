<?php

namespace October\Amber;

use Illuminate\Support\ServiceProvider;

class AmberServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped('system.widgets', \October\Amber\Classes\WidgetManager::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        app('system.widgets')->registerFormWidgets(function ($manager) {
            $manager->registerFormWidget(\October\Amber\FormWidgets\Relation::class, 'relation');
            $manager->registerFormWidget(\October\Amber\FormWidgets\FileUpload::class, 'fileupload');
        });
    }
}
