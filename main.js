const tooltip = document.getElementById("tooltip");

const file_picker = document.getElementById("file_picker");
const text_container = document.getElementById("text_container");

const reset_button = document.getElementById("reset_button");

const smoothness = document.getElementById("smoothness");

const gradient_checkbox = document.getElementById("gradient_checkbox");

var slider_value = 0.0;
var use_gradient = true;

smoothness.value = slider_value;

var display_timer = undefined;

var current_files = [];

clear_full();

file_picker.addEventListener("change", reload_file);

reset_button.addEventListener("click", clear_full);

smoothness.addEventListener("input", change_smoothness);

gradient_checkbox.addEventListener("click", () => {
    use_gradient = gradient_checkbox.checked;

    display_files();
});

function change_smoothness(event)
{
    slider_value = parseFloat(event.target.value);

    display_files(90);
}

function lerp(a, b, i)
{
    return a * (1.0 - i) + b * i;
}

function map_certainty(x)
{
    if (slider_value === 0.0)
    {
        return x;
    }

    const b = -Math.pow(lerp(1.0, 0.000001, slider_value), 10.0);

    return (1.0 / Math.log((b - 1.0) / b)) * Math.log((b - x) / b);
}

function restart_display_timer()
{
    if (display_timer !== undefined)
    {
        clearTimeout(display_timer);
    }

    display_timer = setTimeout(display_files, 500);
}

function show_tooltip(name, p, e)
{
    tooltip.style.display = "inline-block";
    tooltip.style.top = e.layerY + "px";
    tooltip.style.left = e.layerX + "px";

    tooltip.children[0].textContent = name + ": " + (p * 100.0) + "%";
}

function hide_tooltip()
{
    tooltip.style.display = "none";
}

function line_div()
{
    const element = document.createElement("div");
    element.style.display = "inline-flex";

    return element;
}

function clear_full()
{
    clear_words();
    clear_display();
}

function clear_words()
{
    current_files = [];
}

function clear_display()
{
    text_container.replaceChildren();

    text_container.appendChild(line_div());
}

function append_word(word, is_boolean, is_correct_array)
{
    const this_line_div = text_container.lastChild;

    function background_color()
    {
        function bool_color(b)
        {
            return b ? "rgb(160, 255, 160)" : "rgb(255, 130, 130)";
        }

        if (!use_gradient || !is_boolean)
        {
            const p = is_boolean ?
                is_correct_array.reduce((total, is_correct) => is_correct ? (total + 1) : total, 0) / is_correct_array.length
                : map_certainty(is_correct_array);

            return "color-mix(in oklab, "
                + bool_color(false)
                + ", "
                + bool_color(true) + (p * 100.0) + "%"
                + ")";
        }

        const step = 100 / is_correct_array.length;
        const step_relax = step * slider_value;

        function at_step(index)
        {
            return step * index;
        }

        function gradient_concater(acc_args, value)
        {
            const [index, acc] = acc_args;

            const formatted = String(bool_color(value));
            return [
                index + 1,
                (index === 0) ?
                    (formatted + " " + (step - step_relax) + "%")
                    : (acc + ", " + formatted + " " + (at_step(index) + step_relax) + "%" + " " + (at_step(index + 1) - step_relax) + "%")
            ];
        }

        const [_, gradient] = is_correct_array.reduce(gradient_concater, [0, ""]);

        return "linear-gradient(" + gradient + ")";
    }

    function add_listener(value)
    {
        value.addEventListener("mouseenter", (e) => show_tooltip(word, is_correct_array, e));
        value.addEventListener("mouseleave", hide_tooltip);
    }

    if (word === '\n')
    {
        {
            const child = document.createElement("div");
            child.style.width = "10px";
            child.style.background = background_color();

            add_listener(child);

            this_line_div.appendChild(child);
        }

        {
            const child = document.createElement("br");

            text_container.appendChild(child);
        }

        text_container.appendChild(line_div());
    } else
    {
        const child = document.createElement("span");
        child.textContent = word;
        child.style.background = background_color();
        child.style.whiteSpace = "pre";

        add_listener(child);

        this_line_div.appendChild(child);
    }
}

function display_files(line_limit)
{
    clear_display();

    if (!(current_files.length > 0))
    {
        return;
    }

    if (line_limit !== undefined)
    {
        restart_display_timer();
    }

    function early_exit()
    {
        if (line_limit === undefined)
        {
            return false;
        }

        return line_limit < text_container.children.length;
    }

    const sample_value = current_files[0][0][1];
    const is_boolean = (sample_value === true || sample_value === false);

    if (is_boolean)
    {
        for(let i = 0; i < current_files[0].length; ++i)
        {
            if (early_exit())
            {
                return;
            }

            const pair = current_files[0][i];

            append_word(pair[0], is_boolean, current_files.map((file) => file[i][1]));
        }
    } else
    {
        if (current_files.length > 1)
        {
            current_files = [current_files[0]];
        }

        const file = current_files[0];

        for(let i = 0; i < current_files[0].length; ++i)
        {
            if (early_exit())
            {
                return;
            }

            const pair = current_files[0][i];

            append_word(pair[0], is_boolean, pair[1]);
        }
    }
}

function reload_file()
{
    const reader = new FileReader();

    reader.onload = () =>
    {
        current_files.push(JSON.parse(reader.result));

        display_files();
    };

    reader.readAsText(file_picker.files[0]);
}
