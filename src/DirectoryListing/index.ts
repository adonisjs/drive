/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import { Macroable } from 'macroable'
import { DirectoryListingContract, DriveListItem, DriverContract } from '@ioc:Adonis/Core/Drive'

/**
 * Directory listing exposes the API to list directory contents using async iterators
 * and also adds some helper functions for transforming the output of driver list.
 */
export class DirectoryListing<Driver extends DriverContract, T extends DriveListItem>
  extends Macroable
  implements DirectoryListingContract<Driver, T>
{
  /**
   * Required by macroable
   */
  protected static macros = {}
  protected static getters = {}

  /**
   * Functions chain to be executed for transforming generated listing iterable
   */
  private chain: ((this: Driver, source: AsyncIterable<T>) => AsyncIterable<any>)[] = []

  constructor(public driver: Driver, private listing: (this: Driver) => AsyncGenerator<T>) {
    super()
  }

  /**
   * Filter generated items of listing with the given predicate function.
   */
  public filter(predicate: (item: T, index: number, driver: Driver) => Promise<boolean> | boolean) {
    return this.pipe(async function* (source) {
      let index = 0

      for await (const item of source) {
        if (await predicate(item, index++, this)) {
          yield item
        }
      }
    })
  }

  /**
   * Transform generated items of listing with the given mapper function.
   */
  public map<M>(mapper: (item: T, index: number, driver: Driver) => M | Promise<M>) {
    return this.pipe(async function* (source) {
      let index = 0

      for await (const item of source) {
        yield await mapper(item, index++, this)
      }
    })
  }

  /**
   * Do recursive listing of items. Without the next function it will do listing of leaf nodes only.
   * For advanced usage you can pass the next function which will get as parameter current item and it should
   * return the next location for list or null if the recursion should stop and yield the current item.
   * For advanced usage you can also limit the depth of recursion using the second parameter of next function.
   */
  public recursive(
    next: (current: T, depth: number, driver: Driver) => Promise<string | null> | string | null = (
      current
    ) => (current.isFile ? null : current.location)
  ) {
    // get copy of current chain until call to recursive
    // so we can apply it to listing when doing recursion
    const chain = this.chain.slice()

    return this.pipe(async function* (source) {
      for await (const item of source) {
        // call the next function to know if we should continue recursion
        const location = await next(item, 0, this)

        if (location === null) {
          yield item
        } else {
          // create next function to pass to recursive for next level of recursion
          // we are using the original function if it is not using the depth parameter
          const nextWithDepth =
            next.length > 1
              ? (current: T, depth: number, driver: Driver) => next(current, depth + 1, driver)
              : next

          // list the returned location from next function and also apply the chain to it
          const list = chain
            .reduce((listing, fn) => listing.pipe(fn), this.list(location))
            .recursive(nextWithDepth)

          const iterator = list[Symbol.asyncIterator]()
          let nextItem = await iterator.next()

          // if the directory is empty it means it is a leaf and we will yield it
          // else we will yield the items in the directory
          if (nextItem.done) {
            yield item
          } else {
            do {
              yield nextItem.value
              nextItem = await iterator.next()
            } while (!nextItem.done)
          }
        }
      }
    })
  }

  /**
   * Add a piping chain function which gets the current async iterable and returns
   * new async iterable with modified directory listing output.
   * Function this is bound to instance of driver for which the listing is generated.
   * This allows using async generator functions and reference the driver methods easily.
   * Piping will always return clone of the current instance and add the function
   * to the chain of new cloned instance only to prevent side effects.
   */
  public pipe<U>(fn: (this: Driver, iterable: AsyncIterable<T>) => AsyncIterable<U>) {
    const clone = new DirectoryListing(this.driver, this.listing)
    clone.chain = this.chain.concat(fn)
    return clone as unknown as DirectoryListingContract<Driver, U>
  }

  /**
   * Get the final async iterable after passing directory listing through chain of piping functions modifying the output.
   */
  public toIterable(): AsyncIterable<T> {
    return this.chain.reduce(
      (iterable, next) => next.call(this.driver, iterable),
      this.listing.call(this.driver)
    )
  }

  /**
   * Convert directory listing to array.
   */
  public async toArray(): Promise<T[]> {
    const arr: T[] = []

    for await (const item of this.toIterable()) {
      arr.push(item)
    }

    return arr
  }

  /**
   * A method that returns the default async iterator for an object.
   */
  public async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    yield* this.toIterable()
  }
}
