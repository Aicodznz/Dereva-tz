import mapboxgl from 'mapbox-gl';

let mapboxPrototypesPatched = false;

function markStyleTreeRemoved(style: any): void {
  if (!style || typeof style !== 'object') return;
  try {
    style._papoRemoved = true;
    if (Array.isArray(style.fragments)) {
      for (const frag of style.fragments) {
        if (frag?.style) markStyleTreeRemoved(frag.style);
      }
    }
  } catch {
    // ignore
  }
}

function hasActiveScope(style: any): boolean {
  if (!style || style._papoRemoved) return false;
  const im = style.imageManager;
  return Boolean(im && im.images && im.images.has(style.scope));
}

/**
 * Patches Mapbox GL v3 ImageManager prototype (`le`) idempotently so any
 * async sprite/pattern callback firing after `removeScope()` is a safe no-op.
 */
export function patchImageManagerPrototype(im: any): void {
  if (!im) return;
  try {
    const imProto = Object.getPrototypeOf(im) || im.constructor?.prototype;
    if (!imProto || imProto.__papoImageManagerPatched) return;

    const origGetImage = imProto.getImage;
    if (typeof origGetImage === 'function') {
      imProto.getImage = function (id: any, scope: any, ...rest: any[]) {
        if (!this?.images || !this.images.has(scope)) return undefined;
        return origGetImage.call(this, id, scope, ...rest);
      };
    }

    const origHasImage = imProto.hasImage;
    if (typeof origHasImage === 'function') {
      imProto.hasImage = function (id: any, scope: any, ...rest: any[]) {
        if (!this?.images || !this.images.has(scope)) return false;
        return origHasImage.call(this, id, scope, ...rest);
      };
    }

    const origAddImage = imProto.addImage;
    if (typeof origAddImage === 'function') {
      imProto.addImage = function (id: any, scope: any, image: any, ...rest: any[]) {
        if (!this?.images || !this.images.has(scope)) return;
        return origAddImage.call(this, id, scope, image, ...rest);
      };
    }

    const origUpdateImage = imProto.updateImage;
    if (typeof origUpdateImage === 'function') {
      imProto.updateImage = function (id: any, scope: any, image: any, ...rest: any[]) {
        const key = id?.toString?.();
        if (
          !this?.images ||
          !this.images.has(scope) ||
          !this?.updatedImages?.has(scope) ||
          (key !== undefined && !this.images.get(scope)?.has(key))
        ) {
          return;
        }
        return origUpdateImage.call(this, id, scope, image, ...rest);
      };
    }

    const origRemoveImage = imProto.removeImage;
    if (typeof origRemoveImage === 'function') {
      imProto.removeImage = function (id: any, scope: any, ...rest: any[]) {
        const key = id?.toString?.();
        if (
          !this?.images ||
          !this.images.has(scope) ||
          (key !== undefined && !this.images.get(scope)?.has(key))
        ) {
          return;
        }
        return origRemoveImage.call(this, id, scope, ...rest);
      };
    }

    const origListImages = imProto.listImages;
    if (typeof origListImages === 'function') {
      imProto.listImages = function (scope: any, ...rest: any[]) {
        if (!this?.images || !this.images.has(scope)) return [];
        return origListImages.call(this, scope, ...rest);
      };
    }

    const origSetLoaded = imProto.setLoaded;
    if (typeof origSetLoaded === 'function') {
      imProto.setLoaded = function (loaded: boolean, scope: any, ...rest: any[]) {
        if (!this?.images || !this.images.has(scope)) return;
        return origSetLoaded.call(this, loaded, scope, ...rest);
      };
    }

    const origClearUpdatedImages = imProto.clearUpdatedImages;
    if (typeof origClearUpdatedImages === 'function') {
      imProto.clearUpdatedImages = function (scope: any, ...rest: any[]) {
        if (!this?.updatedImages || !this.updatedImages.has(scope)) return;
        return origClearUpdatedImages.call(this, scope, ...rest);
      };
    }

    const origGetImages = imProto.getImages;
    if (typeof origGetImages === 'function') {
      imProto.getImages = function (ids: any, scope: any, cb: any, ...rest: any[]) {
        if (!this?.images || !this.images.has(scope)) {
          try {
            cb?.(null, { images: new Map(), versions: new Map() });
          } catch {
            // ignore
          }
          return;
        }
        return origGetImages.call(this, ids, scope, cb, ...rest);
      };
    }

    const origNotify = imProto._notify;
    if (typeof origNotify === 'function') {
      imProto._notify = function (ids: any, scope: any, cb: any, ...rest: any[]) {
        if (!this?.images || !this.images.has(scope)) {
          try {
            cb?.(null, { images: new Map(), versions: new Map() });
          } catch {
            // ignore
          }
          return;
        }
        return origNotify.call(this, ids, scope, cb, ...rest);
      };
    }

    const origGetPixelSize = imProto.getPixelSize;
    if (typeof origGetPixelSize === 'function') {
      imProto.getPixelSize = function (scope: any, ...rest: any[]) {
        if (!this?.atlasImage || !this.atlasImage.has(scope)) {
          return { width: 1, height: 1 };
        }
        return origGetPixelSize.call(this, scope, ...rest);
      };
    }

    const origGetPattern = imProto.getPattern;
    if (typeof origGetPattern === 'function') {
      imProto.getPattern = function (id: any, scope: any, ...rest: any[]) {
        if (!this?.patterns?.has(scope) || !this?.images?.has(scope)) return null;
        return origGetPattern.call(this, id, scope, ...rest);
      };
    }

    const origStorePattern = imProto.storePattern;
    if (typeof origStorePattern === 'function') {
      imProto.storePattern = function (id: any, scope: any, ...rest: any[]) {
        if (!this?.patterns?.has(scope) || !this?.images?.has(scope)) return;
        return origStorePattern.call(this, id, scope, ...rest);
      };
    }

    const origUpdatePatternAtlas = imProto._updatePatternAtlas;
    if (typeof origUpdatePatternAtlas === 'function') {
      imProto._updatePatternAtlas = function (scope: any, ...rest: any[]) {
        if (!this?.patterns?.has(scope) || !this?.images?.has(scope) || !this?.atlasImage?.has(scope)) {
          return;
        }
        return origUpdatePatternAtlas.call(this, scope, ...rest);
      };
    }

    const origBind = imProto.bind;
    if (typeof origBind === 'function') {
      imProto.bind = function (ctx: any, scope: any, ...rest: any[]) {
        if (!this?.atlasImage?.has(scope)) return;
        return origBind.call(this, ctx, scope, ...rest);
      };
    }

    const origDispatchRenderCallbacks = imProto.dispatchRenderCallbacks;
    if (typeof origDispatchRenderCallbacks === 'function') {
      imProto.dispatchRenderCallbacks = function (ids: any, scope: any, ...rest: any[]) {
        if (!this?.images?.has(scope) || !this?.callbackDispatchedThisFrame?.has(scope)) return;
        return origDispatchRenderCallbacks.call(this, ids, scope, ...rest);
      };
    }

    imProto.__papoImageManagerPatched = true;
  } catch {
    // ignore
  }
}

export function patchStyleFromMap(mapOrStyle: any): void {
  if (!mapOrStyle) return;
  const style = mapOrStyle.style || mapOrStyle;
  if (style?.imageManager) {
    patchImageManagerPrototype(style.imageManager);
  }
}

/**
 * Installs prototype-level Mapbox GL v3 safety guards immediately at startup
 * before any Map or Style instance is created, preventing `_loadSprite` /
 * StrictMode double-mount race crashes after `removeScope()`.
 */
export function installMapboxSafetyPatch(): void {
  if (typeof window === 'undefined' || mapboxPrototypesPatched) return;
  try {
    const gl = mapboxgl as any;
    const StyleProto = gl?.Style?.prototype;
    const MapProto = gl?.Map?.prototype;

    if (StyleProto && !StyleProto.__papoStylePatched) {
      const origStyleRemove = StyleProto._remove;
      if (typeof origStyleRemove === 'function') {
        StyleProto._remove = function (...args: any[]) {
          markStyleTreeRemoved(this);
          return origStyleRemove.apply(this, args);
        };
      }

      const origStyleLoad = StyleProto._load;
      if (typeof origStyleLoad === 'function') {
        StyleProto._load = function (...args: any[]) {
          if (this?._papoRemoved) return;
          if (this?.imageManager) patchImageManagerPrototype(this.imageManager);
          return origStyleLoad.apply(this, args);
        };
      }

      const origLoadSprite = StyleProto._loadSprite;
      if (typeof origLoadSprite === 'function') {
        StyleProto._loadSprite = function (...args: any[]) {
          if (!hasActiveScope(this)) return;
          patchImageManagerPrototype(this.imageManager);
          return origLoadSprite.apply(this, args);
        };
      }

      const origLoadIconset = StyleProto._loadIconset;
      if (typeof origLoadIconset === 'function') {
        StyleProto._loadIconset = function (...args: any[]) {
          if (!hasActiveScope(this)) return;
          patchImageManagerPrototype(this.imageManager);
          return origLoadIconset.apply(this, args);
        };
      }

      const origAddImages = StyleProto.addImages;
      if (typeof origAddImages === 'function') {
        StyleProto.addImages = function (images: any, isSprite?: boolean, ...rest: any[]) {
          if (!hasActiveScope(this)) return this;
          patchImageManagerPrototype(this.imageManager);
          try {
            return origAddImages.call(this, images, isSprite, ...rest);
          } catch {
            return this;
          }
        };
      }

      const origAddImage = StyleProto.addImage;
      if (typeof origAddImage === 'function') {
        StyleProto.addImage = function (...args: any[]) {
          if (!hasActiveScope(this)) return this;
          patchImageManagerPrototype(this.imageManager);
          return origAddImage.apply(this, args);
        };
      }

      const origUpdateImage = StyleProto.updateImage;
      if (typeof origUpdateImage === 'function') {
        StyleProto.updateImage = function (...args: any[]) {
          if (!hasActiveScope(this)) return;
          patchImageManagerPrototype(this.imageManager);
          return origUpdateImage.apply(this, args);
        };
      }

      const origGetImage = StyleProto.getImage;
      if (typeof origGetImage === 'function') {
        StyleProto.getImage = function (...args: any[]) {
          if (!hasActiveScope(this)) return undefined;
          return origGetImage.apply(this, args);
        };
      }

      const origRemoveImage = StyleProto.removeImage;
      if (typeof origRemoveImage === 'function') {
        StyleProto.removeImage = function (...args: any[]) {
          if (!hasActiveScope(this)) return this;
          return origRemoveImage.apply(this, args);
        };
      }

      const origListImages = StyleProto.listImages;
      if (typeof origListImages === 'function') {
        StyleProto.listImages = function (...args: any[]) {
          if (!hasActiveScope(this)) return [];
          return origListImages.apply(this, args);
        };
      }

      StyleProto.__papoStylePatched = true;
    }

    if (MapProto && !MapProto.__papoMapPatched) {
      const origUpdateStyle = MapProto._updateStyle;
      if (typeof origUpdateStyle === 'function') {
        MapProto._updateStyle = function (...args: any[]) {
          if (this?.style) {
            markStyleTreeRemoved(this.style);
          }
          const result = origUpdateStyle.apply(this, args);
          patchStyleFromMap(this);
          return result;
        };
      }

      const origLazyInitEmptyStyle = MapProto._lazyInitEmptyStyle;
      if (typeof origLazyInitEmptyStyle === 'function') {
        MapProto._lazyInitEmptyStyle = function (...args: any[]) {
          const result = origLazyInitEmptyStyle.apply(this, args);
          patchStyleFromMap(this);
          return result;
        };
      }

      const origMapRemove = MapProto.remove;
      if (typeof origMapRemove === 'function') {
        MapProto.remove = function (...args: any[]) {
          if (this?.style) {
            markStyleTreeRemoved(this.style);
          }
          return origMapRemove.apply(this, args);
        };
      }

      MapProto.__papoMapPatched = true;
    }

    mapboxPrototypesPatched = true;
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  installMapboxSafetyPatch();
}
