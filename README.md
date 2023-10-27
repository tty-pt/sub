# @tty-pt/sub - Quantum subscription system

This helps you have state outside of your components, like Redux, but simpler.

Take this example:
```js
import React, { useRef } from "react";
import { Sub, reflect } from "@tty-pt/sub";

class TodoSub extends Sub {
	@reflect()
	add(text) {
		return { ...this.get(), [text]: text };
	}
}

export
const todoSub = new TodoSub();

export default
function Todos(props) {
	const todos = todoSub.use();
	const ref = useRef();

	return <div>{
		<div key="header">
			<input ref={ref}></input>
			<button onClick={() => {
				todoSub.add(ref.current.value);
				ref.current.value = "";
			}}>add</button>
		</div>
		Object.entries(todos).map(([key, value]) => (
			<div key={key}>{value}</div>
		));
	}</div>
}
```

This will display a todo list. When you click the button, it will add the text from
an input into the todo list.

You could do this with state inside of your component. But then, it would get re-set if the Todos component unmounts for some reason.

Meaning you would lose your todos list if the component re-mounted for some reason.

This way. You get to keep your todos, indepedently of the state of the component.

If it disappears and then reappears, it's state is kept.

What does it mean to have state outside components like this? For one you could trigger state changes in this component from afar without having to pass down props in a confusing way. You'd just have to call "todoSub.add". Or subscribe to its value if you were interested.

Now imagine you added this line to that file:
```js
window.todo = todoSub;
```

Well, now you can trigger state changes in the todos component from devTools. Nice.

I've left a few tools there so you can easily debug your methods, setters, getters etc.

You'd just have to do stuff like:
```js
todo.debug = ["emit add"];
```

To see when "add" gets invoked, and what it returns.

## reflect
This decorator will ensure that whatever it decorates has an impact on the internal state of the subscription.
If need be, the components will be updated accordingly.

If you use it on a property, like this:
```js

class DemoSub extends Sub {
	@reflect()
	set open(value) {
		this._target = value;
	}
	// you don't need to also decorate the getter
}
```
then when you set that property, you get its value reflected. Easy. The name of the property gets automatically added to the path, you don't need to provide it.

If you use it on a method, like on the original example, well then the method will also change the state of the subscription for the provided path.

## paths
Paths are strings comprised of numbers/letters in either case, slashes, and dots.

Examples: "open", "$url.open", "test/bookmarks.open".

These strings translate to a path inside the value of the subscription.

Have you noticed that "$url" thing? Let's talk about that next.

## dynamic parameters
Like "$url" over there, it is possible for a parameter in the path to reflect a property.
So that it will get translated to its value, or a value close to it.
I have provided ways to customize how these are translated. More on that later.

"$url" is of special relevance. Because it is often of use to have an url associated with subscription sub-values.
Having our data indexed by url is a good way to make it independent.

Meaning you can have state per index. That might be useful.

You could do this:
```js

class DemoSub extends Sub {
	@reflect("$url")
	set open(value) {
		this._target = value;
	}
}

const demoSub = new DemoSub();
demoSub.url = "exampleUrl1"; // Point to where you want to set state
demoSub.open = true;
demoSub.url = "exampleUrl2";
demoSub.open = true;
```

This would result in the following state:
```json
{
	"exampleUrl1/default": { "open": true },
	"exampleUrl2/default": { "open": true },
}
```

See that "default" over there? That is the suffix component of the url. If we want to customize that, we need to set the "suffix" property.

In your component you could use:
```js
const { open } = demoSub.use("$url");
```

For example.
