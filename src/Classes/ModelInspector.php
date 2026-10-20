<?php namespace Larajax\Ui\Classes;

use Illuminate\Database\Eloquent\Relations\Relation;
use Larajax\Ui\Classes\ModelInspector\Inspection;
use Throwable;

/**
 * ModelInspector centralizes model metadata helpers for October Rain models and
 * plain Eloquent models.
 */
class ModelInspector
{
    /**
     * inspect returns metadata and relation helpers for a model instance or class.
     */
    public function inspect($model): Inspection
    {
        return new Inspection($this, $this->makeModel($model));
    }

    /**
     * isInstanceOf checks a model against a class or interface, supporting both
     * October Rain models and plain Eloquent models.
     */
    public function isInstanceOf($model, string $class): bool
    {
        $model = $this->makeModel($model);

        if (!is_object($model)) {
            return false;
        }

        if (method_exists($model, 'isClassInstanceOf')) {
            return $model->isClassInstanceOf($class);
        }

        return $model instanceof $class;
    }

    /**
     * hasRelation returns true if a relation with the supplied name exists.
     */
    public function hasRelation($model, $name): bool
    {
        $model = $this->makeModel($model);

        if (!is_object($model)) {
            return false;
        }

        if ($this->hasNativeRelationApi($model)) {
            return $model->hasRelation($name);
        }

        return $this->makeEloquentRelationObject($model, $name) instanceof Relation;
    }

    /**
     * getRelationObject returns the relation object for a supplied name.
     */
    public function getRelationObject($model, $name)
    {
        $model = $this->makeModel($model);

        if (!is_object($model) || !$this->hasRelation($model, $name)) {
            return null;
        }

        return $model->{$name}();
    }

    /**
     * getRelationType returns a relationship type based on a supplied name,
     * eg: `belongsTo`, matching the October Rain relation type names.
     */
    public function getRelationType($model, $name): ?string
    {
        $model = $this->makeModel($model);

        if (!is_object($model)) {
            return null;
        }

        if ($this->hasNativeRelationApi($model)) {
            return $model->hasRelation($name) ? $model->getRelationType($name) : null;
        }

        $relation = $this->makeEloquentRelationObject($model, $name);

        return $relation ? lcfirst(class_basename($relation)) : null;
    }

    /**
     * isRelationTypeSingular returns true if the relation is expected to return
     * a single record versus a collection of records.
     */
    public function isRelationTypeSingular($model, $name): bool
    {
        return in_array($this->getRelationType($model, $name), [
            'hasOne',
            'belongsTo',
            'morphTo',
            'morphOne',
            'hasOneThrough'
        ]);
    }

    /**
     * isJsonable returns true if the attribute stores a JSON encoded value, from the model's
     * jsonable definition or an array, json, object or collection cast.
     */
    public function isJsonable($model, $attribute): bool
    {
        $model = $this->makeModel($model);

        if (!is_object($model)) {
            return false;
        }

        if (method_exists($model, 'isJsonable')) {
            return $model->isJsonable($attribute);
        }

        return method_exists($model, 'hasCast') && $model->hasCast($attribute, [
            'array',
            'json',
            'object',
            'collection',
            'encrypted:array',
            'encrypted:collection',
            'encrypted:json',
            'encrypted:object'
        ]);
    }

    /**
     * getRelationSimpleValue returns a relation value directly from its attribute:
     * the related key for singular relations, an array of related keys for
     * multi relations. Mirrors October Rain's relation getSimpleValue methods.
     */
    public function getRelationSimpleValue($model, $name)
    {
        $model = $this->makeModel($model);

        if (!is_object($model)) {
            return null;
        }

        if ($this->hasNativeRelationApi($model) && method_exists($model, 'getRelationSimpleValue')) {
            return $model->getRelationSimpleValue($name);
        }

        $type = $this->getRelationType($model, $name);

        if ($type === null) {
            return null;
        }

        $relation = $this->getRelationObject($model, $name);

        if ($type === 'belongsTo') {
            return $model->getAttribute($relation->getForeignKeyName());
        }

        if ($this->isRelationTypeSingular($model, $name)) {
            return $model->{$name}?->getKey();
        }

        if (in_array($type, ['belongsToMany', 'morphToMany', 'morphedByMany'])) {
            return $model->relationLoaded($name)
                ? $model->getRelation($name)->pluck($relation->getRelatedKeyName())->all()
                : $relation->allRelatedIds()->all();
        }

        return $model->{$name}->modelKeys();
    }

    /**
     * makeRelation returns a new, empty instance of the related model,
     * supporting nested relations with dot notation.
     */
    public function makeRelation($model, $name)
    {
        $model = $this->makeModel($model);

        if (!is_object($model)) {
            return null;
        }

        if (str_contains($name, '.')) {
            $parts = explode('.', $name);
            while ($relationName = array_shift($parts)) {
                if (!$model = $this->makeRelation($model, $relationName)) {
                    return null;
                }
            }

            return $model;
        }

        if ($this->hasNativeRelationApi($model) && method_exists($model, 'makeRelation')) {
            return $model->hasRelation($name) ? $model->makeRelation($name) : null;
        }

        $relation = $this->getRelationObject($model, $name);

        if (!$relation || $this->getRelationType($model, $name) === 'morphTo') {
            return null;
        }

        return $relation->getRelated()->newInstance();
    }

    /**
     * makeModel normalizes class names to instances.
     */
    protected function makeModel($model)
    {
        if (is_string($model) && class_exists($model)) {
            return new $model;
        }

        return $model;
    }

    /**
     * hasNativeRelationApi detects October Rain's relation metadata methods.
     */
    protected function hasNativeRelationApi($model): bool
    {
        return is_object($model) &&
            method_exists($model, 'hasRelation') &&
            method_exists($model, 'getRelationType');
    }

    /**
     * makeEloquentRelationObject safely derives relation metadata from a plain
     * Eloquent relationship method.
     */
    protected function makeEloquentRelationObject($model, $name): ?Relation
    {
        if (!is_object($model) || !method_exists($model, $name)) {
            return null;
        }

        try {
            $method = new \ReflectionMethod($model, $name);
            if ($method->isStatic() || $method->getNumberOfRequiredParameters() > 0) {
                return null;
            }

            $relation = $model->{$name}();
        }
        catch (Throwable $ex) {
            return null;
        }

        return $relation instanceof Relation ? $relation : null;
    }
}