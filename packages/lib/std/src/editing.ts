import {Maybe, Provider} from "./lang"
import {Option} from "./option"

export interface Editing {
    modify<R>(modifier: Provider<Maybe<R>>, mark?: boolean): Option<R>
    mark(): void
}

export namespace Editing {
    export const Transient: Editing = Object.freeze({
        modify: <R>(modifier: Provider<Maybe<R>>, _mark?: boolean): Option<R> => Option.wrap(modifier()),
        mark: () => {}
    })
}