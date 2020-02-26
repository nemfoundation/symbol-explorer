/*
 *
 * Copyright (c) 2019-present for NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License ");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import Constants from '../config/constants'

export default class Timeline2 {
    constructor(initialFuntion, fetchFunction, keyName, pageSize = Constants.PageSize) {
        if(typeof initialFuntion !== 'function')
            throw Error('Cannot create timeline. Initial function is not provided')

        if(typeof fetchFunction !== 'function')
            throw Error('Cannot create timeline. Fetch function is not provided')

        if(keyName === void 0)
            throw Error('Cannot create timeline. Key is not provided')

        this.initialFuntion = initialFuntion;
        this.fetchFunction = fetchFunction;
        this.keyName = keyName;
        this.pageSize = pageSize;
        this.data = [];
        this.next = [];
        this.index = 0;
        this.keys = [];
        this.isLoading = false;
    }

    static empty() {
        return {
            data: [],
            canFetchNext: false,
            canFetchPrevious: false,
            fetchNext: () => {},
            fetchPrevious: () => {},
            reset: () => {},
        }
    }

    async initialFetch() {
        this.isLoading = true;
        this.index = 0;
        this.keys = [];
        this.data = await this.initialFuntion(this.pageSize);
        if(this.data?.length) {
            const lastElement = this.data[this.data.length - 1];
            const key = lastElement[this.keyName]
            this.next = await this.fetchFunction(key, this.pageSize);
            this.keys.push(key)
            this.createNewKey();
        }
        this.isLoading = false;

        return this;
    }

    get canFetchPrevious() {
        return this.index > 0 && this.isLoading === false;
    }

    get canFetchNext() {
        return this.next?.length > 0 && this.isLoading === false;
    }

    get nextKeyValue() {
        if(this.next?.length)
            return this.next[this.next.length - 1][this.keyName];
    }

    get previousKeyValue() {
        return this.keys[this.keys.length - 4];
    }

    get isLive() {
        return this.index === 0
    }

    createNewKey() {
        if(this.next?.length) {
            const newKeyValue = this.next[this.next.length - 1][this.keyName];
            this.keys.push(newKeyValue);
            return newKeyValue;
        }
        else
            this.keys.push(null)
    }

    async fetchNext() {
        if(this.canFetchNext) {
            this.isLoading = true;
            this.data = [].concat.apply([], this.next);
            try {
                this.next = await this.fetchFunction(this.nextKeyValue, this.pageSize);
            }
            catch(e) {
                this.isLoading = false;
                throw e;
            }
            this.createNewKey();
            this.index ++;
        }
        else
            console.error("Timeline cannot fetch next")
        this.isLoading = false;

        return this;
    }

    async fetchPrevious() {
        if(this.canFetchPrevious) {
            this.isLoading = true;
            this.next = [].concat.apply([], this.data);
            try {   
                this.data = await this.fetchFunction(this.previousKeyValue, this.pageSize);
            }
            catch(e) {
                this.isLoading = false;
                throw e;
            }
            this.keys.pop();
            this.index --;
        }
        else
            return await this.initialFetch();
        this.isLoading = false;

        return this;
    }

    async reset() {
        return await this.initialFetch();
    }

    
    // Add latest item to current.
    addLatestItem(item, key) {
        if (!this.isLive)
            throw new Error('internal error: attempted to addLatestItem for non-live timeline.')

        if (this.data[0][this.keyName] === item[this.keyName])
            throw new Error('internal error: attempted to add duplicate item to timeline.')

        const data = [item, ...this.data];
        const next = [data.pop(), ...this.next]
        this.data = [].concat.apply([], data);
        this.keys.pop();
        this.keys.push(next.pop());
        this.next = [].concat.apply([], next);
        
        return this;
    }
}