import React from "react";
import { RouteComponentProps, Link, useHistory } from "react-router-dom";
import formatDistance from "date-fns/formatDistance";
import qs from "query-string";
import toast, { Toaster } from "react-hot-toast";
import { CommitIcon } from "@primer/octicons-react";

import { useCommits, useFlatYaml, useProgressBar } from "../hooks";
import { Repo } from "../types";

import Glass from "../glass.svg";
import FlatLogo from "../flat.svg";

import { JSONDetail } from "./json-detail-container";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { parseFlatCommitMessage } from "../lib";
import { Picker } from "./picker";
import { DisplayCommit } from "./display-commit";

interface RepoDetailProps extends RouteComponentProps<Repo> {}

export function RepoDetail(props: RepoDetailProps) {
  const { match } = props;
  const { owner, name } = match.params;

  const history = useHistory();
  const parsedQueryString = qs.parse(history.location.search);

  const [selectedSha, setSelectedSha] = React.useState<string>(
    (parsedQueryString?.sha as string) || ""
  );
  const filePickerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (selectedSha) {
      const currentQueryString = qs.parse(history.location.search);
      history.push({
        search: qs.stringify({ sha: selectedSha, key: currentQueryString.key }),
      });
    }
  }, [selectedSha]);

  // Hook for fetching flat YAML config
  const yamlQueryResult = useFlatYaml({ owner, name });
  const { data: isFlatRepo, status: yamlQueryStatus } = yamlQueryResult;

  // Hook for fetching commits, once we've determined this is a Flat repo.
  const { data: commits = [], status: commitQueryStatus } = useCommits(
    { owner, name },
    {
      enabled: isFlatRepo === true,
      onSuccess: (commits) => {
        const mostRecentCommitSha = commits[0].sha;

        if (commits.length > 0) {
          if (selectedSha) {
            if (commits.some((commit) => commit.sha === selectedSha)) {
              // noop
            } else {
              toast.error(
                "Hmm, we couldn't find a commit by that SHA. Reverting to the most recent commit.",
                {
                  duration: 4000,
                }
              );

              history.push({
                search: qs.stringify({ sha: mostRecentCommitSha }),
              });
              setSelectedSha(mostRecentCommitSha);
            }
          } else {
            setSelectedSha(mostRecentCommitSha);
          }
        }
      },
    }
  );

  useProgressBar(yamlQueryResult);

  const repoUrl = `https://github.com/${owner}/${name}`;

  const parsedCommit = selectedSha
    ? parseFlatCommitMessage(
        commits?.find((commit) => commit.sha === selectedSha)?.commit.message
      )
    : null;

  const selectedShaIndex = commits.findIndex((d) => d.sha === selectedSha);
  const selectedShaPrevious =
    selectedShaIndex !== -1 ? commits[selectedShaIndex + 1].sha : undefined;

  return (
    <React.Fragment>
      <Toaster position="bottom-left" />
      <div className="bg-white border-b md:flex">
        <Link
          to="/"
          className="inline-block md:flex md:h-full w-16 h-16 p-2 md:border-r hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          <img className="w-full h-full" src={FlatLogo} alt="Flat Logo" />
        </Link>
        <div className="md:flex items-center justify-center px-4">
          <div>
            <p className="text-xs font-medium text-gray-500">Repository</p>
            <p className="font-mono text-sm">
              <a
                className="hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                href={repoUrl}
              >
                {owner}/{name}
              </a>
            </p>
          </div>
        </div>
        {yamlQueryStatus !== "error" && (
          <div className="md:flex items-center justify-center px-4 border-l border-gray py-2">
            {yamlQueryStatus === "loading" ||
              (commitQueryStatus === "loading" && (
                <div className="w-48 h-6 skeleton"></div>
              ))}
            {yamlQueryStatus === "success" &&
              commitQueryStatus === "success" &&
              commits && (
                <Picker<string>
                  label="Choose a commit"
                  placeholder="Select a SHA"
                  onChange={setSelectedSha}
                  value={selectedSha}
                  items={commits.map((commit) => commit.sha)}
                  itemRenderer={(sha) => {
                    const commit = commits.find((commit) => commit.sha === sha);
                    return (
                      <div className="flex flex-col space-y-2">
                        <DisplayCommit message={commit?.commit.message} />
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <p className="text-gray-600">
                              {formatDistance(
                                new Date(commit?.commit.author?.date || ""),
                                new Date(),
                                { addSuffix: true }
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                  selectedItemRenderer={(sha) => (
                    <div className="flex items-center space-x-2">
                      <CommitIcon />
                      <span className="block truncate">
                        <DisplayCommit
                          message={
                            commits.find((commit) => commit.sha === sha)?.commit
                              .message
                          }
                        />
                      </span>
                    </div>
                  )}
                />
              )}
          </div>
        )}
        <div
          className="md:flex items-center justify-center px-4 border-l border-gray py-2"
          ref={filePickerRef}
        ></div>
      </div>
      <React.Fragment>
        {yamlQueryStatus === "loading" && <LoadingState />}
        {yamlQueryStatus === "success" && selectedSha && parsedCommit && (
          <JSONDetail
            key={selectedSha}
            filename={parsedCommit.file.name}
            owner={owner as string}
            name={name as string}
            previousSha={selectedShaPrevious}
            sha={selectedSha}
            filePickerRef={filePickerRef}
          />
        )}
        {yamlQueryStatus === "error" && (
          <ErrorState img={Glass} alt="Magnifying glass icon">
            Hmm, we couldn't load any Flat data from this repository. <br /> Are
            you sure it has a valid Flat action in it?
          </ErrorState>
        )}
      </React.Fragment>
    </React.Fragment>
  );
}
