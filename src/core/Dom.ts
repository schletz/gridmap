/**
 * Looks up an element that the markup is required to contain.
 * @param id Id of the element.
 * @param type Expected element constructor, checked at runtime.
 * @throws Error if the element is missing or has an unexpected type.
 */
export function requireElement<TElement extends HTMLElement>(
    id: string, type: new () => TElement = HTMLElement as unknown as new () => TElement
): TElement {
    const element = document.getElementById(id);
    if (!(element instanceof type)) {
        throw new Error(`Element #${id} is missing or is not a ${type.name}.`);
    }
    return element;
}
