<?php namespace October\Amber\Traits;

use File;
use Exception;
use Throwable;

// @todo move to Filesystem
use System;

/**
 * ViewMaker Trait adds view based methods to a class
 *
 * @package october\amber
 * @author Samuel Georges
 */
trait ViewMaker
{
    /**
     * @var array vars is a list of variables to pass to the page
     */
    public $vars = [];

    /**
     * @var string|array viewPath specifies a path to the views directory
     */
    protected $viewPath;

    /**
     * @var array viewPathGuessCache remembers path guesses for performance.
     */
    protected $viewPathGuessCache = [];

    /**
     * addViewPath prepends a path on the available view path locations
     * @param string|array $path
     * @return void
     */
    public function addViewPath($path, $append = false)
    {
        $this->viewPath = (array) $this->viewPath;

        if (is_array($path)) {
            $this->viewPath = $append
                ? array_merge($this->viewPath, $path)
                : array_merge($path, $this->viewPath);
        }
        else {
            $append
                ? array_push($this->viewPath, $path)
                : array_unshift($this->viewPath, $path);
        }
    }

    /**
     * getViewPaths returns the active view path locations
     * @return array
     */
    public function getViewPaths()
    {
        return (array) $this->viewPath;
    }

    /**
     * makePartial renders a partial file contents located in the views folder
     * @param string $partial The view to load.
     * @param array $params Parameter variables to pass to the view.
     * @param bool $throwException Throw an exception if the partial is not found.
     * @return mixed Partial contents or false if not throwing an exception.
     */
    public function makePartial($partial, $params = [], $throwException = true)
    {
        $notRealPath = realpath($partial) === false || is_dir($partial) === true;
        if (!File::isPathSymbol($partial) && $notRealPath) {
            $folder = strpos($partial, '/') !== false ? dirname($partial) . '/' : '';
            $partial = $folder . '_' . strtolower(basename($partial));
        }

        $partialPath = $this->getViewPath($partial);

        if (!$partialPath || !File::exists($partialPath)) {
            if ($throwException) {
                throw new Exception(__("The partial ':name' is not found.", ['name' => $partial]));
            }

            return false;
        }

        return $this->makeFileContents($partialPath, $params);
    }


    /**
     * getViewPath locates a file based on its definition. The file name can be prefixed
     * with a symbol (~|$) to return in context of the application or plugin base path,
     * otherwise it will be returned in context of this object view path.
     * @param string $fileName
     * @param mixed $viewPath
     * @return string
     */
    public function getViewPath($fileName, $viewPath = null)
    {
        $viewExtensions = ['php', 'htm'];

        if (!isset($this->viewPath)) {
            $this->viewPath = $this->guessViewPath();
        }

        if (!$viewPath) {
            $viewPath = $this->viewPath;
        }

        if (!is_array($viewPath)) {
            $viewPath = [$viewPath];
        }

        // Remove extension from path
        $fileName = File::anyname($fileName);

        // Check in view paths
        if (!File::isPathSymbol($fileName)) {
            foreach ($viewPath as $path) {
                $fullPath = File::symbolizePath($path);

                foreach ($viewExtensions as $extension) {
                    $_fileName = $fullPath . '/' . $fileName . '.' . $extension;
                    if (File::isFile($_fileName)) {
                        return $_fileName;
                    }
                }
            }
        }

        // Check in absolute
        $fileName = File::symbolizePath($fileName);
        if (strpos($fileName, '/') !== false) {
            foreach ($viewExtensions as $extension) {
                $_fileName = $fileName . '.' . $extension;
                if (System::checkBaseDir($_fileName)) {
                    return $_fileName;
                }
            }
        }

        return '';
    }

    /**
     * makeFileContents includes a file path using output buffering
     * @param string $filePath Absolute path to the view file.
     * @param array $extraParams Parameters that should be available to the view.
     * @return string
     */
    public function makeFileContents($filePath, $extraParams = [])
    {
        if (!strlen($filePath) || !File::isFile($filePath) || !System::checkBaseDir($filePath)) {
            return '';
        }

        if (!is_array($extraParams)) {
            $extraParams = [];
        }

        $vars = array_merge(
            $this->vars,
            $extraParams,
            ['_context' => $extraParams]
        );

        $obLevel = ob_get_level();

        ob_start();

        extract($vars);

        // We'll evaluate the contents of the view inside a try/catch block so we can
        // flush out any stray output that might get out before an error occurs or
        // an exception is thrown. This prevents any partial views from leaking.
        try {
            include $filePath;
        }
        catch (Throwable $e) {
            $this->handleViewException($e, $obLevel);
        }

        return ob_get_clean();
    }

    /**
     * handleViewException handles a view exception
     */
    protected function handleViewException(Throwable $e, int $obLevel): void
    {
        while (ob_get_level() > $obLevel) {
            ob_end_clean();
        }

        throw $e;
    }

    /**
     * guessViewPath guesses the package path for the called class
     * @param string $suffix An extra path to attach to the end
     * @return string
     */
    public function guessViewPath($suffix = '')
    {
        $class = get_called_class();

        return $this->guessViewPathFrom($class, $suffix);
    }

    /**
     * guessViewPathFrom guesses the package path from a specified class, including
     * an optional suffix to attach at the end, and the option to return a public
     * path instead of a local one.
     * @param string $class
     * @param string $suffix
     * @return string
     */
    public function guessViewPathFrom($class, $suffix = '')
    {
        if (is_object($class)) {
            $class = get_class($class);
        }

        if (!array_key_exists($class, $this->viewPathGuessCache)) {
            $classFile = realpath(dirname(File::fromClass($class)));
            $classPath = null;
            if ($classFile) {
                $classFolder = class_basename($class);
                $classPath = "{$classFile}/{$classFolder}";
                if (!is_dir($classPath)) {
                    $classFolder = strtolower($classFolder);
                    $classPath = "{$classFile}/{$classFolder}";
                }
            }

            $this->viewPathGuessCache[$class] = $classPath;
        }

        $guessedPath = $this->viewPathGuessCache[$class];
        if ($guessedPath !== null) {
            $guessedPath .= $suffix;
        }

        return $guessedPath;
    }
}
