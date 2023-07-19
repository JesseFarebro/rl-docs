# PDM Workflow

[pdm](https://pdm.fming.dev/latest/) is a modern Python package manager that was built in the wake of
[PEP 582](https://peps.python.org/pep-0582/). Sadly, the Python steering committee rejected PEP 582
but pdm continues to support the spec. We'll first give an outline of PEP 582 and why this spec
and pdm is useful for your project.

## Why pdm & PEP 582?

Some who are familiar with Javascript might have encountered a `node_modules` folder
when working with Node.JS projects. PEP 582 was supposed to be an alternative to
Python virtualenvs that gave Python an analogous `__pypackages__` folder where
all your Python packages would be stored locally. At runtime the interpreter would include
the packages in this folder.

We'll enumerate some of the immediate benefits of pdm & PEP 582:

1. pdm supports proper lockfiles (a file that lists exact dependency versions & hashes) so your
   dependencies can always be deterministically restored from the lockfile. This means you'll never
   have a situation where your collaborator ends up with bugs due to dependency resolution. Note: this is
   more powerful than `pip freeze` and `pip freeze` can still encounter some nuanced issues. Conda / Mamba
   also doesn't have native support for lockfiles and this is still an area of active development for these
   projects.
2. We can use a pdm container that just contains our Python interpreter & pdm. With PEP 582
   both our project and its packages can be stored outside the container locally on our filesystem.
   This has the advantage of standardizing the interpreter across machines and keeping the image size small (no dependencies in the container).
   You can be gauranteed everything is reproducible no matter the cluster.
3. There's no need for the user to develop in a container or even understand what a container is.
   We can transparently create an alias to pdm inside our container. It appears to the user
   as if they're developing and running code on the host.
4. Central installation cache. If you have multiple projects that use the same dependencies
   these will only be installed once, pdm will symlink the dependencies in `__pypackages__` for you.
5. `__pypackages__` is relocatable, this isn't possible with Conda / Mamba nor Python virtual environments.
   For example, want to move your project over to a different cluster, just `rsync` the whole project folder
   and everything will just work on the new cluster. Note: It's still best to "sync" your packages
   on a new machine instead of copying `__pypackages__`, because of (1) you're guaranteed to resolve
   the same dependencies.
6. Completely side-step any dependency problems on the host machine. All dependencies are resolved in the
   pdm container which has a recent OS.

## Getting Started

We'll create a new project and show how to manage dependencies with pdm. To get started we'll create a
new directory locally for our project, also we'll need to load singularity for the pdm container.

```sh
mkdir ~/scratch/my-project && cd $_

module load singularity
```

Now you have two options for running pdm, you can enter a shell in the container using `singularity shell --nv oras://ghcr.io/jessefarebro/containers/pdm:3.10` but we can achieve a frictonless setup by just using creating an alias to `pdm` inside of our container like such:

```sh
echo "alias pdm='singularity --quiet exec --nv oras://ghcr.io/jessefarebro/containers/pdm:3.10 pdm'" >> ~/.bash_aliases
```

With the alias setup we can create our new project with `pdm init`:

```sh
pdm init

Creating a pyproject.toml for PDM...
Please enter the Python interpreter to use
0. /usr/local/bin/python (3.10)
1. /usr/local/bin/python3.10 (3.10)
Please select (0): 0
Would you like to create a virtualenv with /usr/local/bin/python? [y/n] (y): n
You are using the PEP 582 mode, no virtualenv is created.
For more info, please visit https://peps.python.org/pep-0582/
Is the project a library that is installable?
If yes, we will need to ask a few more questions to include the project name and build backend [y/n] (n): n
License(SPDX name) (MIT):
Author name:
Author email:
Python requires('*' to allow any) (>=3.10):
Changes are written to pyproject.toml.
```

Once your project is initialized we can add a dependency with `pdm add`, e.g.,

```sh
pdm add torch
```

Now notice the `pdm.lock` file that was created. pdm can use this to re-create this exact configuration
of dependencies. Also notice the `__pypackages__` folder, this is where all our dependencies
are kept.

::: tip
You should commit the `pdm.lock` file so you or your collaborators can reproduce
this exact configuration of dependencies. If you're on a new machine you can use
the `pdm sync` command to download dependencies as they exist in the lockfile, e.g.,

```sh
pdm sync --no-self
```

The `--no-self` flag just tells pdm to not install your project, we're
usually not developing a library so this isn't necesarry.

If you never want pdm to install your project you can modify your `pyproject.toml`
to include:

::: code-group

```toml [pyproject.toml]

[tool.pdm.options] // [!code ++]
add = ["--no-self"] // [!code ++]
install = ["--no-self"] // [!code ++]

```

:::

Now you can simply run: `python` and all your dependencies in `__pypackages__`
will be magically discovered :tada:!

## Central Installation Cache

We can tell pdm to create a global installation cache. What does this mean?
pdm will always cache wheels from the registry but if you enable the installation
cache and you use the same dependency in multiple projects,
e.g., `torch` in `~/scratch/project-1` and `~/scratch/project-2`, pdm will only keep one
version of the uncompressed package on disk and symlink it to both of your projects,
so as an illustrative example you'd have:

```
~/scratch/project-1/__pypackages__/lib/torch -> ~/.cache/pdm/packages/torch
~/scratch/project-2/__pypackages__/lib/torch -> ~/.cache/pdm/packages/torch
```

This greatly reduces the disk space required for storing Python dependencies, especially
for our workloads where we have large dependencies like Cuda.

To enable this globally you can run:

```sh
pdm config install.cache on
```

::: tip
You might run out of disk space on the home partition, you can tell pdm where to store
its cache with `pdm config cache_dir`, on our clusters it's best to do:

```sh
mkdir ~/scratch/.cache
pdm config cache_dir ~/scratch/.cache/pdm
```

:::

::: danger
If you use the global cache your `__pypackages__` folder will no longer be relocatable,
i.e., you can't copy it to a new machine. You can enable / disable the global cache
on a per-project basis with the `--local` flag, i.e.,:

```sh
pdm config install.cache on --local
```

:::

## Useful Recipes

### Managing Dependencies

Check out the [pdm documentation](https://pdm.fming.dev/latest/usage/dependency/) on
managing dependencies.

#### Adding a dependency

Using `torch` as an example:

```sh
pdm add torch
```

#### Remove a dependency

Using `torch` as an example:

```sh
pdm remove torch
```

#### Installing packages from `pdm.lock`

```sh
pdm sync --no-self
```

#### Updating a dependency

Using `torch` as an example:

```sh
pdm update torch
```

## Sample Slurm Submission Script

Here's what a sample submission script would look like with pdm:

```sh
#!/bin/bash
#SBATCH --ntasks=1
#SBATCH --export=NONE
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --gres=gpu:1
#SBATCH --time=1-00:00:00
set -eEuo pipefail

# Load cuda and singularity
module load cuda/11.8 singularity

# Make sure to pass `--nv` to properly forward the GPU
pdm run my_script.py "$@"
```

## Troubleshooting

### How do I add Jax as a dependency?

If you want to install Jax with GPU support you have to install a custom wheel from
Jax's pypi registry. You must tell pdm how to discover these wheels, to do so
modify your `pyproject.toml` file with the following:

::: code-group

```toml [pyproject.toml]


[[tool.pdm.source]] // [!code ++]
name = "jax" // [!code ++]
url = "https://storage.googleapis.com/jax-releases/jax_cuda_releases.html" // [!code ++]
verify_ssl = true // [!code ++]
type = "find_links" // [!code ++]
```

:::

### How can I run Python scripts / binaries that are usually in my venv?

You have to options, you can use `pdm run {command}`.
Also, check out the [scripts documentation](https://pdm.fming.dev/latest/usage/scripts/)
for more information for more powerful features to alias commands.

### PyTorch can't load cuda libraries when using a central installation cache

This seems to be a bug: [https://github.com/pdm-project/pdm/issues/1732](https://github.com/pdm-project/pdm/issues/1732). As a workaround you can do:

```sh
pdm config install.cache_method pth --local
```

which fixes the problem.
