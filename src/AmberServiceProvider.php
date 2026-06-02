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
    }
}
