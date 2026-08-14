const tooltip = document.getElementById("tooltip");

const file_picker = document.getElementById("file_picker");
const text_container = document.getElementById("text_container");

const reset_button = document.getElementById("reset_button");

const smoothness = document.getElementById("smoothness");

const gradient_checkbox = document.getElementById("gradient_checkbox");

const data_info_text = document.getElementById("data_info");

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

function word_accuracy(word)
{
    const [correct, total] = word_matches(word);

    return ((correct / total) * 100.0) + "%";
}

function word_matches(word)
{
    const [total, correct] = current_files[0].reduce((acc, pair) => {
        const [total, correct] = acc;

        const new_correct = pair[1] ? (correct + 1) : correct;

        return (pair[0] === word || pair[0] === (" " + word)) ? [total + 1, new_correct] : [total, correct];
    }, [0, 0]);

    return [correct, total];
}

function top_for_percent(percent)
{
    const goal_count = current_files[0].length * percent;

    var amount = 0;

    for(; amount < current_files[0].length; ++amount)
    {
        if (current_files[0].reduce((acc, x) => x[1] < amount ? (acc + 1) : acc, 0) >= goal_count)
        {
            break;
        }
    }

    return amount;
}

function longest_spans_above(certainty)
{
    const corrects = current_files[0].map((x) => x[1] > certainty);

    let spans = [];
    let current_span = 0;
    for(let i = 0; i < corrects.length; ++i)
    {
        if (corrects[i])
        {
            current_span += 1;
        } else
        {
            spans.push([[i - current_span, i], current_span]);
            current_span = 0;
        }
    }

    return spans.filter((x) => x[1] > 0).toSorted((a, b) => a[1] === b[1] ? 0 : (a[1] > b[1] ? -1 : 1));
}

function log_longest_spans_above(certainty, start, end)
{
    const spans = longest_spans_above(certainty);

    let output = "";

    const start_index = start === undefined ? 0 : start;
    const end_index = end === undefined ? start_index + 10 : end;

    for(let span_id = start_index; span_id < end_index; ++span_id)
    {
        output += span_id + ": ";

        for(let i = spans[span_id][0][0]; i < spans[span_id][0][1]; ++i)
        {
            output += current_files[0][i][0];
        }

        output += "\n";
    }

    console.log(output);
}

function set_data_info_text(text)
{
    data_info_text.textContent = text;
}

function error_message(message)
{
    set_data_info_text("error: " + message);
}

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

function map_top(pair)
{
    const [x, total_places] = pair;

    const last_place = lerp(total_places, 1, (1.0 - Math.pow(1.0 - slider_value, 3.0)));

    return 1.0 - Math.max(Math.min(x / last_place, 1.0), 0.0);
}

function restart_display_timer()
{
    if (display_timer !== undefined)
    {
        clearTimeout(display_timer);
    }

    display_timer = setTimeout(display_files, 500);
}

function show_tooltip(name, mode, p, word_index, maybe_predicted, e)
{
    tooltip.style.display = "inline-block";
    tooltip.style.left = e.layerX + "px";

    var value;
    if (mode === "bool")
    {
        value = p.map((is_correct) => is_correct ? "✅" : "❌").reduce((acc, x) => acc + x);
    } else if (mode === "certainty")
    {
        value = "certainty: " + (p * 100.0) + "%";
    } else if (mode === "top")
    {
        value = "place: " + (p[0] + 1) + "/" + p[1];
    } else
    {
        console.log("unrecognized mode: " + mode);
    }

    function fmt(x)
    {
        return x === "\n" ? "\\n" : x;
    }

    var tooltip_text = "";

    tooltip_text = fmt(name) + "\n";
    tooltip_text += "word index: " + word_index + "\n";
    tooltip_text += value;

    if (maybe_predicted !== undefined)
    {
        tooltip_text += "\npredicted: " + fmt(maybe_predicted);
    }

    tooltip.children[0].textContent = tooltip_text;

    tooltip.style.top = (e.layerY - tooltip.offsetHeight) + "px";
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
    set_data_info_text("no data loaded");

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

function append_word(word, mode, word_value, word_index, maybe_predicted)
{
    const this_line_div = text_container.lastChild;

    const is_boolean = mode === "bool";

    function background_color()
    {
        function bool_color(b)
        {
            return b ? "rgb(160, 255, 160)" : "rgb(255, 130, 130)";
        }

        const is_gradient_mode = (mode === "top") || (mode === "certainty");

        if (!use_gradient || is_gradient_mode)
        {
            var p;

            if (mode === "bool")
            {
                p = word_value.reduce((total, is_correct) => is_correct ? (total + 1) : total, 0) / word_value.length;
            } else if (mode === "certainty")
            {
                p = map_certainty(word_value);

                if (!use_gradient)
                {
                    p = p > 0.5 ? 1.0 : 0.0;
                }
            } else if (mode === "top")
            {
                p = map_top(word_value);
            } else
            {
                console.log("unrecognized mode: " + mode);
            }

            return "color-mix(in oklab, "
                + bool_color(false)
                + ", "
                + bool_color(true) + (p * 100.0) + "%"
                + ")";
        }

        const step = 100 / word_value.length;
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

        const [_, gradient] = word_value.reduce(gradient_concater, [0, ""]);

        return "linear-gradient(" + gradient + ")";
    }

    function add_listener(value)
    {
        value.addEventListener("mouseenter", (e) => show_tooltip(word, mode, word_value, word_index, maybe_predicted, e));
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

    function set_to_last()
    {
        if (current_files.length > 1)
        {
            current_files = [current_files[current_files.length - 1]];
        }
    }

    function data_is_boolean(sample)
    {
        return (sample === true || sample === false);
    }

    function data_mode()
    {
        var is_boolean = data_is_boolean(current_files[0][0][1]);

        current_files.forEach((file) => {
            if (is_boolean !== data_is_boolean(file[0][1]))
            {
                // files are different types
                set_to_last();
            }
        });

        is_boolean = data_is_boolean(current_files[0][0][1]);

        var mode;

        if (is_boolean)
        {
            mode = "bool";
        } else
        {
            set_to_last();

            if (current_files[0].some((pair) => {
                return pair[1] > 1;
            }))
            {
                mode = "top";
            } else
            {
                mode = "certainty";
            }
        }

        return mode;
    }

    const mode = data_mode();

    const total_words = current_files[0].length;

    if (mode === "bool")
    {
        var total_correct = 0;

        for(let i = 0; i < total_words; ++i)
        {
            if (early_exit())
            {
                return;
            }

            const pair = current_files[0][i];

            if (!current_files.every((file) => file[i][0] === pair[0]))
            {
                error_message("data words mismatch");

                set_to_last();

                display_files();

                return;
            }

            if (current_files.some((file) => file[i][1]))
            {
                total_correct += 1;
            }

            append_word(
                pair[0],
                mode,
                current_files.map((file) => file[i][1]),
                i,
                current_files.length === 1 ? pair[2] : undefined
            );
        }

        var message = "total combined accuracy: " + ((total_correct / total_words) * 100.0) + "%";
        message += "\n";
        message += total_correct + "/" + total_words;

        set_data_info_text(message);
    } else if (mode === "certainty")
    {
        set_to_last();

        var total_score = 0.0;

        const file = current_files[0];

        for(let i = 0; i < total_words; ++i)
        {
            if (early_exit())
            {
                return;
            }

            const pair = file[i];

            total_score += pair[1];

            append_word(pair[0], mode, pair[1], i, pair[2]);
        }

        const total_error = total_words - total_score;

        var message = "total error: " + total_error;
        message += "\n";
        message += "average error: " + ((total_error / total_words) * 100.0) + "%";
        message += "\n";
        message += "total score: " + total_score;
        message += "\n";
        message += "accuracy: " + ((total_score / total_words) * 100.0) + "%";

        set_data_info_text(message);
    } else if (mode === "top")
    {
        set_to_last();

        var total_place = 0;

        const file = current_files[0];

        const metadata_count = 1;
        const total_places = file[total_words - metadata_count][1];

        for(let i = 0; i < (total_words - metadata_count); ++i)
        {
            if (early_exit())
            {
                return;
            }

            const pair = file[i];

            total_place += pair[1];

            append_word(pair[0], mode, [pair[1], total_places], i, pair[2]);
        }

        var message = "average place: " + ((total_place / total_places) + 1);

        set_data_info_text(message);
    } else
    {
        console.log("unrecognized mode: " + mode);
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
