<?php namespace October\Amber\Classes;

use File;

/**
 * ViewPathGuesser resolves and memoizes the convention-based view directory
 * for a given class (the sibling directory named after the class basename).
 *
 * The resolution is filesystem-derived and process-invariant, so the cache
 * lives for the lifetime of the PHP process rather than the request.
 */
class ViewPathGuesser
{
    /**
     * @var array<class-string, string|null> cache of resolved class paths
     */
    protected static array $cache = [];

    /**
     * guess returns the absolute path to the directory next to the class file
     * whose name matches the class basename (lowercase preferred, StudlyCase
     * as a fallback). Returns null when the class file cannot be located.
     */
    public static function guess(string $class): ?string
    {
        if (array_key_exists($class, self::$cache)) {
            return self::$cache[$class];
        }

        $classFile = realpath(dirname(File::fromClass($class)));
        $classPath = null;

        if ($classFile) {
            $classFolder = strtolower(class_basename($class));
            $classPath = "{$classFile}/{$classFolder}";
            if (!is_dir($classPath)) {
                $classFolder = class_basename($class);
                $classPath = "{$classFile}/{$classFolder}";
            }
        }

        return self::$cache[$class] = $classPath;
    }
}
