import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import produce from 'immer';
import {
  createStore as createRedexStore,
} from 'redux';

// 模拟可选链操作符取值
const getDepValue = (obj, dep) => {
  for (const key of dep.split('.')) {
    if (!obj[key]) return;
    obj = obj[key];
  }
  return obj;
};

const createStore = (preloadedState = null) => {
  // store
  const store = createRedexStore(produce((draft, action) => {
    // immer 初次action为默认的 {type: @@Init} action
    // 所以需要判断是否有 action.updater
    return typeof action.updater === 'function' ? action.updater(draft) : draft;
  }), preloadedState);

  // 存储deps
  const wm = new WeakMap();

  // diff判断
  const diff = (baseDeps, deps) => {
    // 是否改变
    let diffed = false;
    // 根据依赖key获取的值
    const depValues = [];
    const storeState = store.getState();
    deps.forEach((dep, index) => {
      const depValue = getDepValue(storeState, dep);
      depValues.push(depValue);
      if (depValue !== baseDeps[index]) diffed = true;
    });
    return {
      diffed,
      depValues,
    };
  };

  const dispatch = (updater, type) => {
    store.dispatch({
      type: type ?? '@@Update',
      updater,
    });
  };

  const subscribe = (handler, deps) => {
    deps && deps.length && wm.set(handler, []);
    return store.subscribe(() => {
      if (deps && deps.length) {
        const {
          diffed,
          depValues,
        } =  diff(wm.get(handler), deps);
        if (diffed) {
          handler(store.getState());
        }
        wm.set(handler, depValues);
      } else {
        handler(store.getState());
      }
    });
  };

  const useStoreState = (deps) => {
    const depsRef = useRef(deps);
    depsRef.current = deps;
    const [state, setState] = useState(store.getState());
    useEffect(() => {
      depsRef.current && wm.set(setState, []);
      return store.subscribe(() => {
        if (depsRef.current && depsRef.current.length) {
          const {
            diffed,
            depValues,
          } =  diff(wm.get(setState), depsRef.current);
          if (diffed) {
            setState(store.getState());
          }
          wm.set(setState, depValues);
        } else {
          setState(store.getState());
        }
      });
    }, []);
    return state;
  };

  const useStoreDispatch = () => {
    const dispatch = useCallback((updater, type) => {
      store.dispatch({
        type: type ?? '@@Update',
        updater,
      });
    }, []);
    return dispatch;
  };

  const useStore = (deps) => {
    const state = useStoreState(deps);
    const dispatch = useStoreDispatch();
    return [state, dispatch];
  };

  return {
    get state() {
      return store.getState();
    },
    dispatch,
    subscribe,
    useStoreState,
    useStoreDispatch,
    useStore,
  };
};

export default createStore;

/**
store
  .state
  .dispath((draft) => {})
  .subscribe((state) => {})
  .useStoreState(); // return state
  .useStoreDispatch() // return dispath
  .useStore() // return [state, dispatch]
 */
