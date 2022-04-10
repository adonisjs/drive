/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import { DirectoryListingContract, DriveListItem, DriverContract } from '@ioc:Adonis/Core/Drive'

/**
 * Directory listing exposes the API to list directory contents using async iterators
 * and also adds some helper functions for transforming the output of driver list.
 */
export class DirectoryListing<Driver extends DriverContract, T = DriveListItem>
  implements DirectoryListingContract<Driver, T>
{
  /**
   * Functions chain to be executed for transforming generated listing iterable
   */
  private chain: ((this: Driver, source: AsyncIterable<T>) => AsyncIterable<any>)[] = []

  constructor(public driver: Driver, private listing: (this: Driver) => AsyncGenerator<T>) {}

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
  public map<M>(mapper: (t: T, index: number, driver: Driver) => M | Promise<M>) {
    return this.pipe(async function* (source) {
      let index = 0

      for await (const item of source) {
        yield await mapper(item, index++, this)
      }
    })
  }

  /**
   * Add a piping chain function which gets the current async iterable and returns
   * new async iterable with modified directory listing output.
   * Function this is bound to instance of driver for which the listing is generated.
   * This allows using async generator functions and reference the driver methods easily.
   */
  public pipe<U>(fn: (this: Driver, iterable: AsyncIterable<T>) => AsyncIterable<U>) {
    this.chain.push(fn)
    return this as unknown as DirectoryListingContract<Driver, U>
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
  public async *[Symbol.asyncIterator](): AsyncIterator<T> {
    yield* this.toIterable()
  }
}
